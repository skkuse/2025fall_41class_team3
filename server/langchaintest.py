#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
리팩토링 포인트
- 이름 대신 **ID 기반 선택**으로 위치 바이어스 제거
- LLM 입출력 최소화: 요약 JSON만 전달, 응답은 [id,id,...] 순수 배열
- 안정성: 엄격한 검증(Pydantic), 타임아웃/재시도, 로깅, 예외 처리
- 구조화: Config/DB/Filtering/LLM/Presentation 모듈화
- 재현성: user_id+날짜 기반 시드로 셔플 고정(동일 입력 → 동일 결과)
- LangChain 호환: langchain_openai 우선, 실패 시 구버전 import fallback
"""

import os
import sys
import json
import difflib
import re
import time
import math
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import pymysql
from dotenv import load_dotenv

# --- LangChain / Pydantic ---
try:
    # 신형 경로 (langchain>=0.2)
    from langchain_openai import ChatOpenAI
except Exception:
    # 구형 호환
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
    db_host: str = os.environ.get("DB_HOST", "")
    db_user: str = os.environ.get("DB_USER", "")
    db_password: str = os.environ.get("DB_PASSWORD", "")
    db_name: str = os.environ.get("DB_NAME", "")
    db_charset: str = "utf8mb4"
    top_n_view: int = int(os.environ.get("TOP_N_VIEW", "30"))  # LLM에 보여줄 후보 개수
    select_k: int = int(os.environ.get("SELECT_K", "5"))       # 최종 선택 개수
    llm_timeout_s: int = int(os.environ.get("LLM_TIMEOUT_S", "30"))
    llm_retries: int = int(os.environ.get("LLM_RETRIES", "2"))
    reason_chunk_size: int = int(os.environ.get("REASON_CHUNK_SIZE", "20"))
    reason_max_tokens: int = int(os.environ.get("REASON_MAX_TOKENS", "800"))
    name_fallback_cutoff: float = float(os.environ.get("NAME_FALLBACK_CUTOFF", "0.85"))

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

def preprocess_policy_row(policy: Dict[str, Any]) -> Dict[str, Any]:
    # 리스트형으로 normalize
    for key in ["zipCd", "mrgSttsCd", "schoolCd", "jobCd", "plcyMajorCd", "sbizCd", "plcyKywdNm"]:
        policy[key] = split_field(policy.get(key))
    # 정수 normalize
    for k in ["sprtTrgtMinAge", "sprtTrgtMaxAge", "earnMinAmt", "earnMaxAmt", "id"]:
        policy[k] = _to_int(policy.get(k), 0)
    # 텍스트 기본값
    for k in ["plcyNm", "lclsfNm", "mclsfNm", "plcyPvsnMthdCd", "plcyExplnCn", "plcySprtCn"]:
        policy[k] = (policy.get(k) or "").strip()
    # 기타 flag
    policy["sprtTrgtAgeLmtYn"] = (policy.get("sprtTrgtAgeLmtYn") or "N").strip()
    policy["earnCndSeCd"] = (policy.get("earnCndSeCd") or "무관").strip()
    return policy

def load_policies_from_db(cfg: AppConfig) -> List[Dict[str, Any]]:
    db = MySQL(cfg)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM policies")
        rows = cur.fetchall()
    policies = [preprocess_policy_row(r) for r in rows]
    logger.info("policies loaded: %d", len(policies))
    return policies

def load_user_from_db(cfg: AppConfig, user_id: str) -> Dict[str, Any]:
    db = MySQL(cfg)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email=%s", (user_id,))
        user = cur.fetchone()
    if not user:
        raise ValueError(f"사용자 {user_id}를 찾을 수 없습니다.")

    # 표준화
    profile: Dict[str, Any] = {}
    profile["region"] = [user["location"].strip()] if user.get("location") else []
    profile["marriage"] = [user["maritalStatus"].strip()] if user.get("maritalStatus") else []
    profile["education"] = [user["education"].strip()] if user.get("education") else []
    profile["job"] = [user["job"].strip()] if user.get("job") else []
    profile["major"] = [user["major"].strip()] if user.get("major") else []

    # 관심/특화 JSON
    def _loads_safe(s, default):
        try:
            return json.loads(s) if s else default
        except Exception:
            return default
    profile["interest_keywords"] = _loads_safe(user.get("interests"), [])
    profile["special"] = _loads_safe(user.get("specialGroup"), [])

    # 나이
    age = 0
    if user.get("birthDate"):
        try:
            birth = datetime.strptime(str(user["birthDate"]), "%Y-%m-%d")
            today = datetime.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        except Exception:
            age = 0
    profile["age"] = age

    # 소득
    profile["income"] = _to_int(user.get("income"), 0)

    # 원시 필드도 필요하면 붙여두자
    profile["_raw"] = user
    return profile

# --------------------------
# 필터링
# --------------------------
def _multi_field_match(policy_list: List[str], user_list: List[str]) -> bool:
    # 정책이 비어있거나 '무관' 류면 통과
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
        # 연령
        age_limit = p.get("sprtTrgtAgeLmtYn", "N")
        if age_limit != "N":
            min_age = _to_int(p.get("sprtTrgtMinAge"), 0)
            max_age = _to_int(p.get("sprtTrgtMaxAge"), 200)
            ua = _to_int(user.get("age"), 0)
            if not (min_age == 0 and max_age == 0) and not (min_age <= ua <= max_age):
                continue

        # 지역/결혼/학력/직업/전공/특화
        if not _multi_field_match(p.get("zipCd", []), user.get("region", [])):    continue
        if not _multi_field_match(p.get("mrgSttsCd", []), user.get("marriage", [])): continue
        if not _multi_field_match(p.get("schoolCd", []), user.get("education", [])): continue
        if not _multi_field_match(p.get("jobCd", []), user.get("job", [])):          continue
        if not _multi_field_match(p.get("plcyMajorCd", []), user.get("major", [])):  continue
        if not _multi_field_match(p.get("sbizCd", []), user.get("special", [])):     continue

        # 소득
        income_type = p.get("earnCndSeCd", "무관")
        if income_type not in ("무관", "제한없음", ""):
            min_income = _to_int(p.get("earnMinAmt"), 0)
            max_income = _to_int(p.get("earnMaxAmt"), int(1e9))
            ui = _to_int(user.get("income"), 0)
            if not (min_income <= ui <= max_income):
                continue

        # 관심 키워드가 있으면 교집합 필요
        if user.get("interest_keywords"):
            uks = set(user.get("interest_keywords", []))
            pks = set(p.get("plcyKywdNm", []))
            if not (uks & pks):
                continue

        result.append(p)
    logger.info("filtered policies: %d -> %d", len(policies), len(result))
    return result

# --------------------------
# 요약/스코어/셔플(바이어스 완화)
# --------------------------
def _intersect(a: List[str], b: List[str]) -> List[str]:
    if not a or not b:
        return []
    sb = set(b)
    return [x for x in a if x in sb]

def summarize_for_llm(p: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(p.get("id") or -1),
        "name": (p.get("plcyNm") or "")[:120],
        "category": [p.get("lclsfNm") or "", p.get("mclsfNm") or ""],
        "method": p.get("plcyPvsnMthdCd") or "",
        "support": (p.get("plcySprtCn") or "")[:240],
        "desc": (p.get("plcyExplnCn") or "")[:240],
        "matches": {
            "region": _intersect(p.get("zipCd", []), user.get("region", []))[:1],
            "age": {
                "limit": p.get("sprtTrgtAgeLmtYn", "N"),
                "min": _to_int(p.get("sprtTrgtMinAge"), 0),
                "max": _to_int(p.get("sprtTrgtMaxAge"), 0),
                "user": _to_int(user.get("age"), 0),
            },
            "income": {
                "type": p.get("earnCndSeCd") or "",
                "min": _to_int(p.get("earnMinAmt"), 0),
                "max": _to_int(p.get("earnMaxAmt"), 0),
                "user": _to_int(user.get("income"), 0),
            },
            "keywords": _intersect(p.get("plcyKywdNm", []), user.get("interest_keywords", []))[:3],
        },
    }

def _tokenize_korean(s: str) -> List[str]:
    # 간단 토크나이저(공백/구두점 기준). 형태소 분석기 없이도 의미 있는 프리스코어 목적.
    return [t for t in re.split(r"[^\w가-힣]+", s.lower()) if t]

def pre_score(summary: Dict[str, Any], pref_tokens: List[str]) -> int:
    text = f"{summary.get('name','')} {' '.join(summary.get('matches',{}).get('keywords',[]))} {summary.get('support','')} {summary.get('desc','')}"
    tl = text.lower()
    sc = sum(1 for t in pref_tokens if t and t in tl)
    sc += len(summary.get("matches", {}).get("keywords", []))  # 관심 키워드 일치 가산
    return sc

def deterministic_shuffle(items: List[Dict[str, Any]], seed: int) -> None:
    # 파이썬 내장 random 없이, 재현 가능 셔플(피셔-예이츠) + 간단 LCG
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

def build_candidate_view(policies: List[Dict[str, Any]], user: Dict[str, Any],
                         user_preference: str, top_n_view: int, stable_seed: int) -> List[Dict[str, Any]]:
    summaries = [summarize_for_llm(p, user) for p in policies]
    pref_tokens = _tokenize_korean(user_preference)
    summaries.sort(key=lambda s: pre_score(s, pref_tokens), reverse=True)
    view = summaries[:top_n_view]
    deterministic_shuffle(view, stable_seed)  # 동점/근접 점수 항목들 섞기(위치 바이어스 감소)
    return view

# --------------------------
# LLM I/O
# --------------------------
class ReasonItemModel(BaseModel):
    id: int
    reason: str = Field(min_length=6, max_length=200)

def new_llm(cfg: AppConfig, temperature: float, max_tokens: int) -> ChatOpenAI:
    # 일부 드라이버는 timeout 인자를 지원
    try:
        return ChatOpenAI(
            model=cfg.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=cfg.openai_api_key,
            timeout=cfg.llm_timeout_s,
        )
    except TypeError:
        # timeout 미지원 드라이버 호환
        return ChatOpenAI(
            model=cfg.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=cfg.openai_api_key,
        )

def select_policy_ids_with_llm(cfg: AppConfig, candidates: List[Dict[str, Any]],
                               user_profile: Dict[str, Any], user_preference: str,
                               k: int) -> List[int]:
    """
    candidates: summarize_for_llm 결과의 서브셋(길이 제한됨)
    LLM 출력: [1,23,5,9,14] 같은 **순수 JSON 배열**만 허용
    """
    sys_prompt = (
        "역할: 한국 청년정책 추천 에디터. 사실만 사용.\n"
        "반드시 **순수 JSON 배열**만 반환하라. 예: [1, 23, 5, 9, 14]\n"
        "설명/문장/키/객체 금지. **정수 ID만** {k}개. 목록에 없는 ID 금지."
    ).format(k=k)

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
    }
    payload = json.dumps(candidates, ensure_ascii=False)
    prompt = (
        f"사용자 정보: {json.dumps(user_info, ensure_ascii=False)}\n"
        f"추가 희망 조건: {user_preference}\n"
        f"아래 데이터에서 사용자에게 가장 적합한 정책 {k}개의 id만 골라라.\n"
        f"{payload}"
    )

    llm = new_llm(cfg, temperature=0.2, max_tokens=100)

    last_exc: Optional[Exception] = None
    for attempt in range(cfg.llm_retries + 1):
        try:
            resp = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=prompt)])
            txt = resp.content.strip()
            txt = re.sub(r"^```(?:json)?\n?|```$", "", txt).strip()
            arr = json.loads(txt)
            ids = []
            for x in arr:
                if isinstance(x, int):
                    ids.append(x)
                elif isinstance(x, str) and x.isdigit():
                    ids.append(int(x))
            # 유효성: 후보 목록에 존재하는 id만 허용
            valid_ids = {int(s["id"]) for s in candidates}
            ids = [i for i in ids if i in valid_ids]
            if not ids:
                raise ValueError("빈 ID 목록")
            return ids[:k]
        except Exception as e:
            last_exc = e
            wait = 0.5 * (attempt + 1)
            logger.warning("select_policy_ids_with_llm 실패(%d): %s -> %.1fs 재시도", attempt + 1, e, wait)
            time.sleep(wait)

    logger.error("select_policy_ids_with_llm 최종 실패: %s", last_exc)
    return []

def generate_llm_reasons(cfg: AppConfig, policies: List[Dict[str, Any]],
                         user: Dict[str, Any], user_intent: str) -> List[Dict[str, Any]]:
    """
    선택된 정책들에 대해 간결한 추천 문구를 LLM으로 생성.
    - 청크 처리 + Pydantic 유효성 검증
    - 실패 시 조용히 스킵(로컬 fallback 존재)
    """
    if not policies:
        return policies

    llm = new_llm(cfg, temperature=0.3, max_tokens=cfg.reason_max_tokens)
    sys_prompt = (
        "역할: 한국 청년정책 추천 에디터. 사실만 사용해 간결하고 설득력 있는 한국어 문장을 작성.\n"
        "반드시 JSON 배열만 반환하라. 배열 요소는 {\"id\": number, \"reason\": string} 형식이어야 한다.\n"
        "reason은 60~110자 내외, 상투어·과장 금지, 각 정책마다 **차별화 포인트** 1~2개 포함."
    )

    # 요약 목록(토큰 절약)
    summaries = [summarize_for_llm(p, user) for p in policies]

    for i in range(0, len(summaries), cfg.reason_chunk_size):
        chunk = summaries[i : i + cfg.reason_chunk_size]
        payload = json.dumps(chunk, ensure_ascii=False)
        user_prompt = (
            f"사용자 의도: {user_intent}\n"
            f"데이터: {payload}\n\n"
            "위 데이터에 대해 JSON 배열로 각각 {\"id\": id, \"reason\": \"간단한 추천 문구\"} 형식으로 응답하라."
        )

        last_exc: Optional[Exception] = None
        for attempt in range(cfg.llm_retries + 1):
            try:
                resp = llm([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
                txt = resp.content.strip()
                txt = re.sub(r"^```(?:json)?\n?|```$", "", txt).strip()
                arr = json.loads(txt)
                validated: List[ReasonItemModel] = []
                for obj in arr:
                    validated.append(ReasonItemModel(**obj))
                # 매핑
                rid2reason = {ri.id: ri.reason for ri in validated}
                for p in policies:
                    pid = int(p.get("id") or -1)
                    if pid in rid2reason:
                        p["reason"] = rid2reason[pid]
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
        parts.append(f"관심 키워드({', '.join(kw[:2])})와 일치")
        badges.append(f"관심:{kw[0]}")

    method = (policy.get("plcyPvsnMthdCd") or "").strip()
    if method:
        badges.append(method)

    # 추가 차별화: 지역 일치 / 연령 범위 명시
    if _intersect(policy.get("zipCd", []), user.get("region", [])):
        parts.append("거주지역 조건 부합")
    if policy.get("sprtTrgtAgeLmtYn") != "N":
        parts.append(f"연령 {policy.get('sprtTrgtMinAge',0)}~{policy.get('sprtTrgtMaxAge',0)}세 대상")

    reason = " / ".join(parts[:3]) if parts else "사용자 조건과 부합"
    return reason, badges[:3]

# --------------------------
# 이름기반 Fallback(선택)
# --------------------------
def find_policies_by_name(policies: List[Dict[str, Any]], name_list: List[str], cutoff=0.85) -> List[Dict[str, Any]]:
    results = []
    for name in name_list:
        best = None
        best_score = -1.0
        for p in policies:
            s = difflib.SequenceMatcher(None, (p.get("plcyNm") or "").strip(), name).ratio()
            if s > best_score:
                best, best_score = p, s
        if best and best_score >= cutoff:
            results.append(best)
        else:
            logger.warning("이름 Fallback 실패: %s", name)
    return results

# --------------------------
# 메인 파이프라인
# --------------------------
def main(argv: List[str]) -> int:
    if len(argv) < 3:
        print("사용법: python3 langchaintest.py <user_id(email)> \"<user_preference>\"")
        return 1
    user_id = argv[1]
    user_preference = argv[2].strip()

    if not CFG.openai_api_key:
        logger.error("OPENAI_API_KEY가 없습니다.")
        return 2

    # 입력/데이터
    user_profile = load_user_from_db(CFG, user_id)
    policies = load_policies_from_db(CFG)
    filtered = filter_policies(policies, user_profile)

    if not filtered:
        print(json.dumps([], ensure_ascii=False, indent=2))
        return 0

    # 재현성 있는 셔플 시드: user_id + 오늘(UTC)
    today_key = datetime.now(timezone.utc).strftime("%Y%m%d")
    stable_seed = abs(hash((user_id, today_key))) & 0x7FFFFFFF

    # 후보 생성(바이어스 줄이기)
    candidates = build_candidate_view(
        filtered, user_profile, user_preference, CFG.top_n_view, stable_seed
    )

    # ID 선택 (핵심 개선)
    selected_ids = select_policy_ids_with_llm(
        CFG, candidates, user_profile, user_preference, k=CFG.select_k
    )

    # LLM이 비정상 응답했을 때의 **최후의 보루**:
    # - 후보 상위 K개를 스코어 순으로 대체 선택
    if not selected_ids:
        logger.warning("LLM ID 선택 실패 → 프리스코어 상위 K로 대체")
        pref_tokens = _tokenize_korean(user_preference)
        candidates_sorted = sorted(
            candidates, key=lambda s: pre_score(s, pref_tokens), reverse=True
        )
        selected_ids = [int(s["id"]) for s in candidates_sorted[:CFG.select_k]]

    id_to_policy = {int(p.get("id") or -1): p for p in filtered}
    details = [id_to_policy[i] for i in selected_ids if i in id_to_policy]

    # 로컬 기본 이유/배지
    for p in details:
        r, b = build_reason_and_badges(p, user_profile)
        p["reason"], p["badges"] = r, b

    # LLM 정교화 이유(옵션)
    details = generate_llm_reasons(CFG, details, user_profile, user_preference)

    # 최종 출력(JSON)
    print(json.dumps(details, ensure_ascii=False, indent=2))
    return 0

# --------------------------
# Entry
# --------------------------
if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except KeyboardInterrupt:
        logger.info("중단됨")
        sys.exit(130)
    except Exception as e:
        logger.exception("치명적 오류: %s", e)
        sys.exit(99)

