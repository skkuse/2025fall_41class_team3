#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
개선 요약 (완성본)
- 지역 매칭 강화: "경기도 수원시" vs "경기"/"경기도"/"11" 같은 케이스 대응
- 관심키워드: 하드필터 제거 -> 점수화(랭킹 신호로만 사용)
- 재현성 시드: Python hash 랜덤성 제거 -> sha256 기반 정수 시드
- 배지/설명: 근거 약한 "조건 부합" 문구 제거(오해 방지)
- LLM 호출: invoke 통일 + ID 유효성/중복 제거 강화
- ✅ 핵심: user_preference를 '의도(intent)'로 해석해서 우선 반영
  - preference에서 intent 추출(취업/주거/창업/금융/세금/교육)
  - 정책을 rule-based로 policy_type 분류
  - 후보 구성에서 intent 타입 최소 확보 (top_n_view의 60%, 최소 3개)
  - pre_score에서 intent 불일치 항목의 키워드 보너스 강하게 축소
  - LLM 선택 프롬프트에도 intent 제약(가능하면 최소 3개)
"""

import os
import sys
import json
import re
import time
import math
import logging
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import pymysql
from dotenv import load_dotenv

# --- LangChain / Pydantic ---
try:
    from langchain_openai import ChatOpenAI
except Exception:
    from langchain.chat_models import ChatOpenAI

from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, ValidationError, Field

# --------------------------
# 초기화 / 로깅
# --------------------------
load_dotenv()

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("policy-reco")

# --------------------------
# Config
# --------------------------
@dataclass
class AppConfig:
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    llm_model: str = os.environ.get("LLM_MODEL", "gpt-4o")

    # --- Vector Search (Embeddings + FAISS) ---
    embedding_model: str = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
    vector_top_m: int = int(os.environ.get("VECTOR_TOP_M", "200"))  # Hard filter 후 FAISS로 Top-M
    faiss_cache_dir: str = os.environ.get("FAISS_CACHE_DIR", ".faiss_cache")  # 인덱스 캐시 경로

    db_host: str = os.environ.get("DB_HOST", "")
    db_user: str = os.environ.get("DB_USER", "")
    db_password: str = os.environ.get("DB_PASSWORD", "")
    db_name: str = os.environ.get("DB_NAME", "")
    db_charset: str = "utf8mb4"

    top_n_view: int = int(os.environ.get("TOP_N_VIEW", "40"))
    select_k: int = int(os.environ.get("SELECT_K", "5"))

    llm_timeout_s: int = int(os.environ.get("LLM_TIMEOUT_S", "30"))
    llm_retries: int = int(os.environ.get("LLM_RETRIES", "2"))

    reason_chunk_size: int = int(os.environ.get("REASON_CHUNK_SIZE", "20"))
    reason_max_tokens: int = int(os.environ.get("REASON_MAX_TOKENS", "800"))

    region_bonus_exact: float = float(os.environ.get("REGION_BONUS_EXACT", "6.0"))
    region_bonus_partial: float = float(os.environ.get("REGION_BONUS_PARTIAL", "4.0"))
    region_bonus_nationwide: float = float(os.environ.get("REGION_BONUS_NATIONWIDE", "0.0"))
    region_bonus_unknown: float = float(os.environ.get("REGION_BONUS_UNKNOWN", "0.5"))
    region_bonus_mismatch: float = float(os.environ.get("REGION_BONUS_MISMATCH", "-10.0"))

    kw_bonus_per_overlap: float = float(os.environ.get("KW_BONUS_PER_OVERLAP", "2.2"))
    kw_bonus_cap: int = int(os.environ.get("KW_BONUS_CAP", "5"))

    length_penalty_short: float = float(os.environ.get("LENGTH_PENALTY_SHORT", "-1.5"))
    support_short_len: int = int(os.environ.get("SUPPORT_SHORT_LEN", "20"))
    desc_short_len: int = int(os.environ.get("DESC_SHORT_LEN", "30"))

    pref_weight_default: float = float(os.environ.get("PREF_WEIGHT_DEFAULT", "1.5"))
    pref_weight_with_intent: float = float(os.environ.get("PREF_WEIGHT_WITH_INTENT", "2.8"))

    intent_match_bonus: float = float(os.environ.get("INTENT_MATCH_BONUS", "10.0"))
    intent_mismatch_bonus: float = float(os.environ.get("INTENT_MISMATCH_BONUS", "-4.0"))
    kw_scale_intent_match: float = float(os.environ.get("KW_SCALE_INTENT_MATCH", "1.0"))
    kw_scale_intent_mismatch: float = float(os.environ.get("KW_SCALE_INTENT_MISMATCH", "0.25"))


CFG = AppConfig()

# --------------------------
# DB 유틸
# --------------------------
class MySQL:
    def __init__(self, cfg: AppConfig):
        self.cfg = cfg

    def connect(self):
        return pymysql.connect(
            host=self.cfg.db_host,
            user=self.cfg.db_user,
            password=self.cfg.db_password,
            database=self.cfg.db_name,
            charset=self.cfg.db_charset,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )

def _to_int(x, default=0) -> int:
    try:
        if x in (None, ""):
            return default
        return int(x)
    except Exception:
        return default

def split_field(val: Any) -> List[str]:
    if val is None:
        return []
    s = str(val).strip()
    if s in ("제한없음", "무관", ""):
        return []
    return [v.strip() for v in s.split(",") if v.strip()]

# --------------------------
# 지역 정규화/매칭
# --------------------------
KOR_SIDO_CODE = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주", "30": "대전", "31": "울산",
    "36": "세종",
    "41": "경기", "42": "강원", "43": "충북", "44": "충남",
    "45": "전북", "46": "전남",
    "47": "경북", "48": "경남",
    "50": "제주",
}

def normalize_user_region_list(region_list: List[str]) -> List[str]:
    tokens: List[str] = []
    for r in region_list or []:
        rr = (r or "").strip()
        if not rr:
            continue
        parts = [p.strip() for p in rr.split() if p.strip()]
        tokens.append(rr)
        tokens.extend(parts)

        for p in parts:
            if p.endswith("도") and len(p) >= 2:
                tokens.append(p[:-1])
            if p.endswith("특별시") or p.endswith("광역시") or p.endswith("자치시") or p.endswith("자치도"):
                tokens.append(
                    p.replace("특별시", "").replace("광역시", "").replace("자치시", "").replace("자치도", "")
                )

    seen = set()
    out: List[str] = []
    for t in tokens:
        if t not in seen:
            out.append(t)
            seen.add(t)
    return out

def normalize_policy_region_list(policy_list: List[str]) -> List[str]:
    out: List[str] = []
    for x in policy_list or []:
        s = (x or "").strip()
        if not s:
            continue
        if s.isdigit() and s in KOR_SIDO_CODE:
            out.append(KOR_SIDO_CODE[s])
        out.append(s)
        if s.endswith("도") and len(s) >= 2:
            out.append(s[:-1])

    seen = set()
    uniq: List[str] = []
    for t in out:
        if t not in seen:
            uniq.append(t)
            seen.add(t)
    return uniq

def region_match(policy_regions: List[str], user_regions: List[str]) -> bool:
    if not policy_regions:
        return True
    if not user_regions:
        return True

    pr = normalize_policy_region_list(policy_regions)
    ur = normalize_user_region_list(user_regions)

    for p in pr:
        for u in ur:
            if p and u and (p in u or u in p):
                return True
    return False

def region_match_strength(policy_regions: List[str], user_regions: List[str]) -> str:
    if not policy_regions:
        return "nationwide"
    if not user_regions:
        return "unknown"

    pr = normalize_policy_region_list(policy_regions)
    ur = normalize_user_region_list(user_regions)

    if set(pr) & set(ur):
        return "exact"

    for p in pr:
        for u in ur:
            if p and u and (p in u or u in p):
                return "partial"

    return "mismatch"

# --------------------------
# Intent / Policy type (룰 기반)
# --------------------------
INTENT_LABELS = ["employment", "housing", "startup", "finance", "tax", "education", "other"]

def detect_intent(preference: str) -> Optional[str]:
    t = (preference or "").lower()

    if any(k in t for k in ["취업", "일자리", "채용", "구직", "면접", "인턴", "고용", "재직", "취업지원"]):
        return "employment"
    if any(k in t for k in ["주거", "월세", "전세", "임대", "주택", "보증금", "청년주택"]):
        return "housing"
    if any(k in t for k in ["창업", "스타트업", "사업화", "창업지원", "보육", "액셀러"]):
        return "startup"
    if any(k in t for k in ["대출", "보증", "융자", "금리", "이자", "자금", "한도", "상환"]):
        return "finance"
    if any(k in t for k in ["세금", "세액", "공제", "감면", "연말정산", "과세"]):
        return "tax"
    if any(k in t for k in ["교육", "훈련", "과정", "강의", "캠프", "프로그램", "멘토링"]):
        return "education"
    return None

def classify_policy_type(p: Dict[str, Any]) -> str:
    text = f"{p.get('plcyNm','')} {p.get('plcySprtCn','')} {p.get('plcyExplnCn','')}".lower()

    if any(k in text for k in ["취업", "일자리", "채용", "구직", "면접", "인턴", "직업", "고용", "재직", "취업지원"]):
        return "employment"
    if any(k in text for k in ["주거", "월세", "전세", "임대", "주택", "기숙사", "보증금", "청년주택"]):
        return "housing"
    if any(k in text for k in ["창업", "스타트업", "사업화", "보육", "액셀러", "입주", "창업공간"]):
        return "startup"
    if any(k in text for k in ["대출", "보증", "융자", "금리", "이자", "자금", "한도", "상환"]):
        return "finance"
    if any(k in text for k in ["세금", "세액", "공제", "감면", "소득공제", "연말정산"]):
        return "tax"
    if any(k in text for k in ["교육", "훈련", "과정", "강의", "캠프", "프로그램", "멘토링", "컨설팅"]):
        return "education"

    return "other"

# --------------------------
# 정책/유저 로드
# --------------------------
def preprocess_policy_row(policy: Dict[str, Any]) -> Dict[str, Any]:
    for key in ["zipCd", "mrgSttsCd", "schoolCd", "jobCd", "plcyMajorCd", "sbizCd", "plcyKywdNm"]:
        policy[key] = split_field(policy.get(key))

    for k in ["sprtTrgtMinAge", "sprtTrgtMaxAge", "earnMinAmt", "earnMaxAmt", "id"]:
        policy[k] = _to_int(policy.get(k), 0)

    for k in ["plcyNm", "lclsfNm", "mclsfNm", "plcyPvsnMthdCd", "plcyExplnCn", "plcySprtCn"]:
        policy[k] = (policy.get(k) or "").strip()

    policy["sprtTrgtAgeLmtYn"] = (policy.get("sprtTrgtAgeLmtYn") or "N").strip()
    policy["earnCndSeCd"] = (policy.get("earnCndSeCd") or "무관").strip()

    min_age = _to_int(policy.get("sprtTrgtMinAge"), 0)
    max_age = _to_int(policy.get("sprtTrgtMaxAge"), 0)
    if min_age == 0 and max_age == 0:
        policy["sprtTrgtAgeLmtYn"] = "N"

    # ✅ policy_type 추가
    policy["policy_type"] = classify_policy_type(policy)
    return policy

def load_policies_from_db(cfg: AppConfig) -> List[Dict[str, Any]]:
    db = MySQL(cfg)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM policies")
        rows = cur.fetchall()
    policies = [preprocess_policy_row(r) for r in rows]
    logger.info("policies loaded: %d", len(policies))
    return policies

def load_policies_from_db_sql_prefilter(cfg: AppConfig, user: Dict[str, Any]) -> List[Dict[str, Any]]:
    ua = _to_int(user.get("age"), 0)
    ui = _to_int(user.get("income"), 0)

    # 지역은 DB 스키마/데이터가 제각각이라 SQL에서 완벽매칭은 힘듦.
    # 대신 "느슨한 OR LIKE"로 1차 축소만 (최종 판정은 region_match가 함)
    region_tokens = normalize_user_region_list(user.get("region", []))
    region_tokens = [t for t in region_tokens if t]  # 안전
    region_tokens = region_tokens[:3]  # 과도한 OR 방지

    where = []
    params = []

    # --- age prefilter ---
    if ua > 0:
        where.append(
            "("
            "sprtTrgtAgeLmtYn='N' "
            "OR (sprtTrgtMinAge=0 AND sprtTrgtMaxAge=0) "
            "OR (sprtTrgtMinAge <= %s AND sprtTrgtMaxAge >= %s)"
            ")"
        )
        params.extend([ua, ua])

    # --- income prefilter ---
    if ui > 0:
        where.append(
            "("
            "earnCndSeCd IN ('무관','제한없음','') "
            "OR earnCndSeCd IS NULL "
            "OR (earnMinAmt <= %s AND earnMaxAmt >= %s)"
            ")"
        )
        params.extend([ui, ui])

    # --- region coarse prefilter (optional) ---
    if region_tokens:
        ors = ["zipCd IS NULL", "zipCd IN ('','무관','제한없음')"]
        for t in region_tokens:
            ors.append("zipCd LIKE %s")
            params.append(f"%{t}%")
        where.append("(" + " OR ".join(ors) + ")")

    sql = "SELECT * FROM policies"
    if where:
        sql += " WHERE " + " AND ".join(where)

    db = MySQL(cfg)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

    policies = [preprocess_policy_row(r) for r in rows]
    logger.info("policies loaded (sql prefilter): %d", len(policies))
    return policies


def load_user_from_db(cfg: AppConfig, user_id: str) -> Dict[str, Any]:
    db = MySQL(cfg)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email=%s", (user_id,))
        user = cur.fetchone()

    if not user:
        raise ValueError(f"사용자 {user_id}를 찾을 수 없습니다.")

    location = (user.get("location") or "").strip()
    marital = (user.get("maritalStatus") or "").strip()
    education = (user.get("education") or "").strip()
    major = (user.get("major") or "").strip()
    job = (user.get("job") or user.get("employmentstatus") or "").strip()

    profile: Dict[str, Any] = {}
    profile["region"] = [location] if location else []
    profile["marriage"] = [marital] if marital else []
    profile["education"] = [education] if education else []
    profile["job"] = [job] if job else []
    profile["major"] = [major] if major else []

    def _loads_safe(s, default):
        try:
            return json.loads(s) if s else default
        except Exception:
            return default

    profile["interest_keywords"] = _loads_safe(user.get("interests"), [])
    profile["special"] = _loads_safe(user.get("specialGroup"), [])

    age = 0
    if user.get("birthDate"):
        try:
            birth = datetime.strptime(str(user["birthDate"]), "%Y-%m-%d")
            today = datetime.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        except Exception:
            age = 0
    profile["age"] = age

    profile["income"] = _to_int(user.get("income"), 0)
    profile["_raw"] = user
    return profile

# --------------------------
# 필터링 (하드필터는 “불가능한 것”만)
# --------------------------
def _multi_field_match(policy_list: List[str], user_list: List[str]) -> bool:
    if not policy_list:
        return True
    if any(p in ("제한없음", "무관", "", None) for p in policy_list):
        return True
    if not user_list:
        return True
    sb = set(user_list)
    return any(p in sb for p in policy_list)

def filter_policies(policies: List[Dict[str, Any]], user: Dict[str, Any]) -> List[Dict[str, Any]]:
    result = []
    for p in policies:
        # 1) age (불가능하면 탈락)
        age_limit = p.get("sprtTrgtAgeLmtYn", "N")
        if age_limit != "N":
            min_age = _to_int(p.get("sprtTrgtMinAge"), 0)
            max_age = _to_int(p.get("sprtTrgtMaxAge"), 200)
            ua = _to_int(user.get("age"), 0)
            if not (min_age == 0 and max_age == 0) and ua and not (min_age <= ua <= max_age):
                continue

        # 2) region (불가능하면 탈락)
        if not region_match(p.get("zipCd", []), user.get("region", [])):
            continue

        # 3) income (조건이 있을 때만 불가능이면 탈락)
        income_type = (p.get("earnCndSeCd") or "무관").strip()
        if income_type not in ("무관", "제한없음", ""):
            min_income = _to_int(p.get("earnMinAmt"), 0)
            max_income = _to_int(p.get("earnMaxAmt"), int(1e9))
            ui = _to_int(user.get("income"), 0)
            if ui and not (min_income <= ui <= max_income):
                continue

        # ✅ marriage/school/job/major/sbiz 는 하드필터에서 제거 (A)
        result.append(p)

    logger.info("filtered policies(strict): %d -> %d", len(policies), len(result))
    return result

# --------------------------
# 요약/스코어
# --------------------------
def _intersect(a: List[str], b: List[str]) -> List[str]:
    if not a or not b:
        return []
    sb = set(b)
    return [x for x in a if x in sb]

def summarize_for_llm(p: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    r_strength = region_match_strength(p.get("zipCd", []), user.get("region", []))
    kw = _intersect(p.get("plcyKywdNm", []), user.get("interest_keywords", []))

    limit = (p.get("sprtTrgtAgeLmtYn") or "N")
    min_age = _to_int(p.get("sprtTrgtMinAge"), 0)
    max_age = _to_int(p.get("sprtTrgtMaxAge"), 0)

    if limit == "N" or (min_age == 0 and max_age == 0):
        age_obj = {"limit": "N", "user": _to_int(user.get("age"), 0)}
    else:
        age_obj = {"limit": limit, "min": min_age, "max": max_age, "user": _to_int(user.get("age"), 0)}

    return {
        "id": int(p.get("id") or -1),
        "policy_type": p.get("policy_type", "other"),
        "name": (p.get("plcyNm") or "")[:120],
        "category": [p.get("lclsfNm") or "", p.get("mclsfNm") or ""],
        "method": p.get("plcyPvsnMthdCd") or "",
        "support": (p.get("plcySprtCn") or "")[:240],
        "desc": (p.get("plcyExplnCn") or "")[:240],
        "matches": {
            "region_strength": r_strength,
            "region_hint": (normalize_policy_region_list(p.get("zipCd", []))[:2] if p.get("zipCd") else []),
            "age": {
                "limit": p.get("sprtTrgtAgeLmtYn", "N"),
                "min": _to_int(p.get("sprtTrgtMinAge"), 0),
                "max": _to_int(p.get("sprtTrgtMaxAge"), 0),
                "user": _to_int(user.get("age"), 0),
            },
            "income": {
                "type": (p.get("earnCndSeCd") or ""),
                "min": _to_int(p.get("earnMinAmt"), 0),
                "max": _to_int(p.get("earnMaxAmt"), 0),
                "user": _to_int(user.get("income"), 0),
            },
            "keywords": kw[:5],
            "keyword_overlap": len(kw),
        },
    }

def _tokenize_korean(s: str) -> List[str]:
    return [t for t in re.split(r"[^\w가-힣]+", (s or "").lower()) if t]

def pre_score(cfg: AppConfig, summary: Dict[str, Any], pref_tokens: List[str], intent: Optional[str]) -> float:
    m = summary.get("matches", {})
    region_strength = m.get("region_strength", "unknown")
    kw_overlap = int(m.get("keyword_overlap", 0))

    text = f"{summary.get('name','')} {' '.join(m.get('keywords',[]))} {summary.get('support','')} {summary.get('desc','')}"
    tl = text.lower()
    pref_hit = sum(1 for t in pref_tokens if t and t in tl)

    region_bonus = {
        "exact": cfg.region_bonus_exact,
        "partial": cfg.region_bonus_partial,
        "nationwide": cfg.region_bonus_nationwide,
        "unknown": cfg.region_bonus_unknown,
        "mismatch": cfg.region_bonus_mismatch,
    }.get(region_strength, 0.0)

    kw_bonus = min(kw_overlap, cfg.kw_bonus_cap) * cfg.kw_bonus_per_overlap

    length_penalty = 0.0
    if len(summary.get("support", "")) < cfg.support_short_len and len(summary.get("desc", "")) < cfg.desc_short_len:
        length_penalty = cfg.length_penalty_short

    policy_type = summary.get("policy_type", "other")
    intent_bonus = 0.0

    if intent:
        if policy_type == intent:
            intent_bonus = cfg.intent_match_bonus
            pref_weight = cfg.pref_weight_with_intent
            kw_bonus *= cfg.kw_scale_intent_match
        else:
            intent_bonus = cfg.intent_mismatch_bonus
            pref_weight = cfg.pref_weight_with_intent
            kw_bonus *= cfg.kw_scale_intent_mismatch
    else:
        pref_weight = cfg.pref_weight_default

    return (pref_hit * pref_weight) + region_bonus + kw_bonus + length_penalty + intent_bonus

# --------------------------
# 재현성 셔플/샘플링
# --------------------------
def stable_seed_int(*parts: str) -> int:
    s = "|".join(parts)
    h = hashlib.sha256(s.encode("utf-8")).hexdigest()
    return int(h[:8], 16)

def deterministic_shuffle(items: List[Any], seed: int) -> None:
    n = len(items)
    a, c, m = 1103515245, 12345, 2**31
    x = seed % m

    def rand():
        nonlocal x
        x = (a * x + c) % m
        return x

    for i in range(n - 1, 0, -1):
        j = rand() % (i + 1)
        items[i], items[j] = items[j], items[i]

def build_candidate_view(
    policies: List[Dict[str, Any]],
    user: Dict[str, Any],
    user_preference: str,
    top_n_view: int,
    seed: int
) -> List[Dict[str, Any]]:
    summaries = [summarize_for_llm(p, user) for p in policies]
    pref_tokens = _tokenize_korean(user_preference)
    intent = detect_intent(user_preference)

    # ✅ 여기서 점수 계산 + 정렬이 맞음
    scored = [(pre_score(CFG, s, pref_tokens, intent), s) for s in summaries]
    scored.sort(key=lambda x: x[0], reverse=True)

    if intent:
        same = [s for _, s in scored if s.get("policy_type") == intent]
        other = [s for _, s in scored if s.get("policy_type") != intent]

        min_intent = max(3, int(top_n_view * 0.6))
        picked = same[:min_intent]

        remain = top_n_view - len(picked)
        deterministic_shuffle(other, seed ^ 0xA5A5A5A5)
        picked += other[:max(0, remain)]
        view = picked
    else:
        keep_main = int(math.ceil(top_n_view * 0.7))
        main = [s for _, s in scored[:keep_main]]

        rest_pool = [s for _, s in scored[keep_main:keep_main + 120]]
        deterministic_shuffle(rest_pool, seed ^ 0xA5A5A5A5)
        extra = rest_pool[: max(0, top_n_view - keep_main)]
        view = main + extra

    deterministic_shuffle(view, seed)
    return view


# --------------------------
# Vector Search (Embeddings + FAISS)
# --------------------------
def _policy_text_for_embedding(p: Dict[str, Any]) -> str:
    """
    임베딩에 넣을 텍스트: 너무 길면 비용/속도 망가짐.
    핵심 필드 위주로 1~2KB 정도로 제한.
    """
    name = (p.get("plcyNm") or "").strip()
    support = (p.get("plcySprtCn") or "").strip()
    desc = (p.get("plcyExplnCn") or "").strip()
    cat = f"{(p.get('lclsfNm') or '').strip()} {(p.get('mclsfNm') or '').strip()}".strip()
    method = (p.get("plcyPvsnMthdCd") or "").strip()
    # 키워드/지역/타입도 약간 섞어주면 의미 유사도에 도움 됨
    kywd = ", ".join((p.get("plcyKywdNm") or [])[:10])
    region = ", ".join((p.get("zipCd") or [])[:5])
    ptype = (p.get("policy_type") or "").strip()

    # 과하게 길면 잘라서 넣기
    support = support[:600]
    desc = desc[:600]

    return (
        f"정책명: {name}\n"
        f"분류: {cat}\n"
        f"유형: {ptype}\n"
        f"지원방식: {method}\n"
        f"지원내용: {support}\n"
        f"설명: {desc}\n"
        f"키워드: {kywd}\n"
        f"지역: {region}\n"
    ).strip()

def _policies_fingerprint(policies: List[Dict[str, Any]]) -> str:
    """
    인덱스 캐시 무효화용 fingerprint.
    DB에 updated_at이 있으면 그걸 쓰는 게 더 좋지만,
    여기선 id + 주요 텍스트 해시로 안정적으로 만들자.
    """
    h = hashlib.sha256()
    for p in sorted(policies, key=lambda x: int(x.get("id") or 0)):
        pid = str(int(p.get("id") or 0)).encode("utf-8")
        h.update(pid)
        h.update(((p.get("plcyNm") or "")[:80]).encode("utf-8"))
        h.update(((p.get("plcySprtCn") or "")[:120]).encode("utf-8"))
        h.update(((p.get("plcyExplnCn") or "")[:120]).encode("utf-8"))
    return h.hexdigest()[:16]

def vector_top_m_with_faiss(
    cfg: AppConfig,
    policies: List[Dict[str, Any]],
    query: str,
    top_m: int
) -> List[Dict[str, Any]]:
    """
    Hard filter 통과 정책들 중에서 FAISS(임베딩 유사도)로 Top-M만 추림.
    - 캐시: policies fingerprint 기반으로 로컬에 저장/재사용
    - 실패 시: 원본 그대로 반환 (서비스 다운 방지)
    """
    if not policies:
        return policies
    if not query or not query.strip():
        return policies[:top_m] if len(policies) > top_m else policies

    try:
        # 지연 import: 환경에 없으면 여기서 바로 예외 나고 fallback 가능
        from langchain_core.documents import Document
        from langchain_openai import OpenAIEmbeddings
        from langchain_community.vectorstores import FAISS
    except Exception as e:
        logger.warning("FAISS/Embeddings 모듈 로드 실패: %s (fallback=로컬 랭킹)", e)
        return policies[:top_m] if len(policies) > top_m else policies

    try:
        os.makedirs(cfg.faiss_cache_dir, exist_ok=True)
        fp = _policies_fingerprint(policies)
        cache_path = os.path.join(cfg.faiss_cache_dir, f"faiss_{fp}")
        meta_path = os.path.join(cfg.faiss_cache_dir, f"faiss_{fp}.json")

        embeddings = OpenAIEmbeddings(
            model=cfg.embedding_model,
            openai_api_key=cfg.openai_api_key,
        )

        # 캐시 로드 시도
        vectorstore = None
        if os.path.isdir(cache_path) and os.path.isfile(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if meta.get("fingerprint") == fp and meta.get("embedding_model") == cfg.embedding_model:
                    vectorstore = FAISS.load_local(
                        cache_path, embeddings, allow_dangerous_deserialization=True
                    )
                    logger.info("FAISS 캐시 로드 성공(fp=%s, n=%d)", fp, meta.get("count", -1))
            except Exception as e:
                logger.warning("FAISS 캐시 로드 실패: %s (재생성)", e)
                vectorstore = None

        # 없으면 새로 생성
        if vectorstore is None:
            docs = []
            for p in policies:
                pid = int(p.get("id") or 0)
                docs.append(
                    Document(
                        page_content=_policy_text_for_embedding(p),
                        metadata={"id": pid},
                    )
                )
            vectorstore = FAISS.from_documents(docs, embeddings)

            # 저장 (다음 실행부터 빠름)
            try:
                vectorstore.save_local(cache_path)
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(
                        {"fingerprint": fp, "embedding_model": cfg.embedding_model, "count": len(policies)},
                        f,
                        ensure_ascii=False,
                    )
                logger.info("FAISS 캐시 저장(fp=%s, n=%d)", fp, len(policies))
            except Exception as e:
                logger.warning("FAISS 캐시 저장 실패(무시): %s", e)

        # 검색: Top-M
        # similarity_search_with_score는 낮을수록 더 유사(거리)일 수도, 점수 정의는 구현에 따라 다름.
        # 우리는 일단 결과 순서만 믿고 id를 추린다.
        hits = vectorstore.similarity_search(query, k=min(top_m, len(policies)))

        top_ids = []
        seen = set()
        for d in hits:
            pid = int(d.metadata.get("id") or 0)
            if pid and pid not in seen:
                top_ids.append(pid)
                seen.add(pid)

        id2p = {int(p.get("id") or 0): p for p in policies}
        out = [id2p[i] for i in top_ids if i in id2p]

        # 혹시 hits가 너무 빈약하면(이상 케이스) fallback
        if not out:
            return policies[:top_m] if len(policies) > top_m else policies

        return out

    except Exception as e:
        logger.warning("vector_top_m_with_faiss 실패: %s (fallback=원본)", e)
        return policies[:top_m] if len(policies) > top_m else policies


# --------------------------
# LLM I/O
# --------------------------
class ReasonItemModel(BaseModel):
    id: int
    reason: str = Field(min_length=6, max_length=200)

def new_llm(cfg: AppConfig, temperature: float, max_tokens: int) -> ChatOpenAI:
    try:
        return ChatOpenAI(
            model=cfg.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=cfg.openai_api_key,
            timeout=cfg.llm_timeout_s,
        )
    except TypeError:
        return ChatOpenAI(
            model=cfg.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=cfg.openai_api_key,
        )

def select_policy_ids_with_llm(
    cfg: AppConfig,
    candidates: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    user_preference: str,
    k: int
) -> List[int]:
    intent = detect_intent(user_preference)

    sys_prompt = (
        "역할: 한국 청년정책 추천 편집자.\n"
        "데이터에 있는 정보만 사용.\n"
        "우선순위:\n"
        "1) region_strength가 exact/partial인 것 우선\n"
        "2) keyword_overlap 높은 것 우선\n"
        "3) 사용자 추가 희망 조건(user_preference)과 제목/설명/지원내용이 맞는 것\n"
        "4) 비슷한 정책만 고르지 말고 성격이 다른 5개로 분산(예: 세금/금융/취업/주거 등)\n"
        f"사용자 intent: {intent or '없음'}\n"
        "제약:\n"
        f"- intent가 있으면, 선택 {k}개 중 최소 3개는 policy_type이 intent와 같아야 한다(가능한 경우).\n"
        "- 후보에 없는 id 금지, 중복 금지.\n"
        f"반드시 순수 JSON 배열만 반환: 정수 id {k}개."
    )

    user_info = {
        "age": int(user_profile.get("age", 0)),
        "region": user_profile.get("region", []),
        "education": user_profile.get("education", []),
        "job": user_profile.get("job", []),
        "major": user_profile.get("major", []),
        "marriage": user_profile.get("marriage", []),
        "special": user_profile.get("special", []),
        "income": int(user_profile.get("income", 0)),
        "interest_keywords": user_profile.get("interest_keywords", []),
        "intent": intent,
    }

    payload = json.dumps(candidates, ensure_ascii=False)
    prompt = (
        f"사용자 정보: {json.dumps(user_info, ensure_ascii=False)}\n"
        f"추가 희망 조건(user_preference): {user_preference}\n"
        f"아래 후보 데이터에서 가장 적합한 정책 {k}개를 고르고, id 배열만 출력하라.\n"
        f"{payload}"
    )

    llm = new_llm(cfg, temperature=0.2, max_tokens=120)
    valid_ids = {int(s["id"]) for s in candidates}

    last_exc: Optional[Exception] = None
    for attempt in range(cfg.llm_retries + 1):
        try:
            resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=prompt)])
            txt = (resp.content or "").strip()
            txt = re.sub(r"^```(?:json)?\n?|```$", "", txt).strip()

            arr = json.loads(txt)
            ids: List[int] = []
            for x in arr:
                if isinstance(x, int):
                    ids.append(x)
                elif isinstance(x, str) and x.isdigit():
                    ids.append(int(x))

            out: List[int] = []
            seen = set()
            for i in ids:
                if i in valid_ids and i not in seen:
                    out.append(i)
                    seen.add(i)
                if len(out) >= k:
                    break

            if not out:
                raise ValueError("빈 ID 목록")
            return out

        except Exception as e:
            last_exc = e
            wait = 0.6 * (attempt + 1)
            logger.warning("select_policy_ids_with_llm 실패(%d): %s -> %.1fs 재시도", attempt + 1, e, wait)
            time.sleep(wait)

    logger.error("select_policy_ids_with_llm 최종 실패: %s", last_exc)
    return []

def generate_llm_reasons(
    cfg: AppConfig,
    policies: List[Dict[str, Any]],
    user: Dict[str, Any],
    user_intent: str
) -> List[Dict[str, Any]]:
    if not policies:
        return policies

    llm = new_llm(cfg, temperature=0.3, max_tokens=cfg.reason_max_tokens)
    sys_prompt = (
        "역할: 한국 청년정책 추천 에디터. 데이터에 있는 사실만 사용.\n"
        "반드시 JSON 배열만 반환. 각 요소는 {\"id\": number, \"reason\": string}.\n"
        "reason은 60~110자. 상투어/과장 금지. 사용자 조건(지역/키워드/연령/지원내용) 중 최소 2개를 근거로 써라."
    )

    summaries = [summarize_for_llm(p, user) for p in policies]

    for i in range(0, len(summaries), cfg.reason_chunk_size):
        chunk = summaries[i:i + cfg.reason_chunk_size]
        payload = json.dumps(chunk, ensure_ascii=False)

        user_prompt = (
            f"사용자 의도: {user_intent}\n"
            f"데이터: {payload}\n"
            "각 정책에 대해 추천 이유를 JSON 배열로 작성하라."
        )

        last_exc: Optional[Exception] = None
        for attempt in range(cfg.llm_retries + 1):
            try:
                resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
                txt = (resp.content or "").strip()
                txt = re.sub(r"^```(?:json)?\n?|```$", "", txt).strip()

                arr = json.loads(txt)
                validated: List[ReasonItemModel] = [ReasonItemModel(**obj) for obj in arr]

                rid2reason = {ri.id: ri.reason for ri in validated}
                for p in policies:
                    pid = int(p.get("id") or -1)
                    if pid in rid2reason:
                        p["reason_llm"] = rid2reason[pid]
                break

            except (json.JSONDecodeError, ValidationError, ValueError) as ve:
                last_exc = ve
                time.sleep(0.7 * (attempt + 1))
                continue
            except Exception as e:
                last_exc = e
                time.sleep(0.7 * (attempt + 1))
                continue

        if last_exc:
            logger.warning("generate_llm_reasons chunk 실패 (i=%d): %s", i, last_exc)

    return policies

# --------------------------
# 프레젠테이션(배지/로컬 이유)
# --------------------------
def build_reason_and_badges(policy: Dict[str, Any], user: Dict[str, Any]) -> Tuple[str, List[str]]:
    badges: List[str] = []
    parts: List[str] = []

    kw = _intersect(policy.get("plcyKywdNm", []), user.get("interest_keywords", []))
    if kw:
        badges.append(f"관심:{kw[0]}")
        parts.append(f"관심 키워드({', '.join(kw[:2])})와 연관")

    rs = region_match_strength(policy.get("zipCd", []), user.get("region", []))
    if rs in ("exact", "partial"):
        hint = normalize_policy_region_list(policy.get("zipCd", []))[:1]
        if hint:
            badges.append(f"지역:{hint[0]}")
        parts.append("거주/신청 지역 조건이 맞는 편")

    if policy.get("sprtTrgtAgeLmtYn") != "N":
        parts.append(f"연령 {policy.get('sprtTrgtMinAge',0)}~{policy.get('sprtTrgtMaxAge',0)}세 대상")

    method = (policy.get("plcyPvsnMthdCd") or "").strip()
    if method:
        badges.append(method)

    reason = " / ".join(parts[:3]) if parts else "사용자 조건과 전반적으로 무난하게 맞는 정책"
    return reason, badges[:3]

# --------------------------
# 메인 파이프라인
# --------------------------
def main(argv: List[str]) -> int:
    if len(argv) < 3:
        print('사용법: python3 recommend.py <user_id(email)> "<user_preference>"')
        return 1

    user_id = argv[1]
    user_preference = argv[2].strip()
    intent = detect_intent(user_preference)

    if not CFG.openai_api_key:
        logger.error("OPENAI_API_KEY가 없습니다.")
        return 2

    user_profile = load_user_from_db(CFG, user_id)
    policies = load_policies_from_db_sql_prefilter(CFG, user_profile)  # (D)
    filtered = filter_policies(policies, user_profile)                 # (A: strict only)

    if not filtered:
        print(json.dumps([], ensure_ascii=False, indent=2))
        return 0

    faiss_pool = vector_top_m_with_faiss(CFG, filtered, user_preference, top_m=CFG.vector_top_m)
    logger.info("FAISS pool: %d -> %d", len(filtered), len(faiss_pool))

    today_key = datetime.now(timezone.utc).strftime("%Y%m%d")
    seed = stable_seed_int(user_id, today_key)

    candidates = build_candidate_view(faiss_pool, user_profile, user_preference, CFG.top_n_view, seed)


    selected_ids = select_policy_ids_with_llm(CFG, candidates, user_profile, user_preference, k=CFG.select_k)

    if not selected_ids:
        logger.warning("LLM ID 선택 실패 → 로컬 스코어 상위 K로 대체")
        pref_tokens = _tokenize_korean(user_preference)
        candidates_sorted = sorted(
            candidates, key=lambda s: pre_score(s, pref_tokens, intent), reverse=True
        )
        selected_ids = [int(s["id"]) for s in candidates_sorted[:CFG.select_k]]

    id_to_policy = {int(p.get("id") or -1): p for p in faiss_pool}
    details = [id_to_policy[i] for i in selected_ids if i in id_to_policy]

    for p in details:
        r, b = build_reason_and_badges(p, user_profile)
        p["reason"] = r
        p["badges"] = b

    details = generate_llm_reasons(CFG, details, user_profile, user_preference)

    for p in details:
        if p.get("reason_llm"):
            p["reason"] = p["reason_llm"]
            del p["reason_llm"]

    print(json.dumps(details, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except KeyboardInterrupt:
        logger.info("중단됨")
        sys.exit(130)
    except Exception as e:
        logger.exception("치명적 오류: %s", e)
        sys.exit(99)
