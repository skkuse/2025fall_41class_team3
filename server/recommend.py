import os
import sys
import json
import difflib
from datetime import datetime
import pymysql
from dotenv import load_dotenv
import openai
import re

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = openai.OpenAI(api_key=OPENAI_API_KEY)

def split_field(val):
    if not val or val.strip() in ["제한없음", "무관"]:
        return []
    return [v.strip() for v in val.split(",") if v.strip()]

def preprocess_policy_row(policy):
    for key in ["zipCd", "mrgSttsCd", "schoolCd", "jobCd", "plcyMajorCd", "sbizCd", "plcyKywdNm"]:
        if key in policy and policy[key]:
            policy[key] = split_field(policy[key])
        else:
            policy[key] = []
    for k in ["sprtTrgtMinAge", "sprtTrgtMaxAge", "earnMinAmt", "earnMaxAmt"]:
        if k in policy:
            try:
                policy[k] = int(policy[k]) if policy[k] not in [None, ""] else 0
            except:
                policy[k] = 0
    return policy

def load_policies_from_db():
    conn = pymysql.connect(
        host=os.environ.get('DB_HOST'),
        user=os.environ.get('DB_USER'),
        password=os.environ.get('DB_PASSWORD'),
        database=os.environ.get('DB_NAME'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM policies")
            policies = cursor.fetchall()
    policies = [preprocess_policy_row(p) for p in policies]
    return policies

def load_user_from_db(user_id):
    conn = pymysql.connect(
        host=os.environ.get('DB_HOST'),
        user=os.environ.get('DB_USER'),
        password=os.environ.get('DB_PASSWORD'),
        database=os.environ.get('DB_NAME'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email=%s", (user_id,))
            user = cursor.fetchone()
    if not user:
        raise ValueError(f"사용자 {user_id}를 찾을 수 없습니다.")

    user["region"] = [user["location"].strip()] if user.get("location") else []
    user["marriage"] = [user["maritalStatus"].strip()] if user.get("maritalStatus") else []
    user["interest_keywords"] = json.loads(user["interests"]) if user.get("interests") else []
    user["special"] = json.loads(user["specialGroup"]) if user.get("specialGroup") else []
    user["education"] = [user["education"].strip()] if user.get("education") else []
    user["job"] = [user["job"].strip()] if user.get("job") else []
    user["major"] = [user["major"].strip()] if user.get("major") else []

    if user.get("birthDate"):
        birth = datetime.strptime(str(user["birthDate"]), "%Y-%m-%d")
        today = datetime.today()
        user["age"] = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    else:
        user["age"] = 0

    return user

def multi_field_match(policy_list, user_list):
    if not policy_list or any(p in ["제한없음", "무관", "", None] for p in policy_list):
        return True
    if not user_list:
        return True
    return any(p == u for u in user_list for p in policy_list)

def filter_policies(policies, user):
    filtered = []
    for p in policies:
        # 연령
        try:
            min_age = int(p.get("sprtTrgtMinAge", 0) or 0)
            max_age = int(p.get("sprtTrgtMaxAge", 200) or 200)
        except:
            min_age, max_age = 0, 200
        age_limit = p.get("sprtTrgtAgeLmtYn", "N")
        if age_limit != "N":
            if min_age == 0 and max_age == 0:
                pass
            elif not (min_age <= user["age"] <= max_age):
                continue

        # 지역
        if not multi_field_match(p.get("zipCd", []), user.get("region", [])):
            continue
        # 결혼상태
        if not multi_field_match(p.get("mrgSttsCd", []), user.get("marriage", [])):
            continue
        # 소득
        income_type = p.get("earnCndSeCd", "무관")
        try:
            min_income = int(p.get("earnMinAmt", 0) or 0)
            max_income = int(p.get("earnMaxAmt", 1e9) or 1e9)
        except:
            min_income, max_income = 0, int(1e9)
        if income_type not in ["무관", "제한없음", ""]:
            if not (min_income <= user["income"] <= max_income):
                continue
        # 학력
        if not multi_field_match(p.get("schoolCd", []), user.get("education", [])):
            continue
        # 취업상태
        if not multi_field_match(p.get("jobCd", []), user.get("job", [])):
            continue
        # 전공
        if not multi_field_match(p.get("plcyMajorCd", []), user.get("major", [])):
            continue
        # 특화
        if not multi_field_match(p.get("sbizCd", []), user.get("special", [])):
            continue
        # 관심 키워드
        if user.get("interest_keywords"):
            if not multi_field_match(p.get("plcyKywdNm", []), user.get("interest_keywords", [])):
                continue

        filtered.append(p)
    return filtered

def _intersect(a, b):
    if not a or not b: return []
    sb = set(b); return [x for x in a if x in sb]

def _summarize_policy_for_llm(p, user):
    return {
        "id": p.get("id"),
        "name": p.get("plcyNm"),
        "category": [p.get("lclsfNm"), p.get("mclsfNm")],
        "method": p.get("plcyPvsnMthdCd"),               # 보조금/대출/바우처/프로그램/공공기관 등
        "support": (p.get("plcySprtCn") or "")[:300],     # 지원내용 요약(너무 길면 잘라 안정화)
        "desc": (p.get("plcyExplnCn") or "")[:300],       # 설명내용
        "matches": {
            "region": _intersect(p.get("zipCd", []), user.get("region", [])),
            "age": {
                "limit": p.get("sprtTrgtAgeLmtYn", "N"),
                "min": int(p.get("sprtTrgtMinAge") or 0),
                "max": int(p.get("sprtTrgtMaxAge") or 0),
                "user": int(user.get("age") or 0),
            },
            "income": {
                "type": p.get("earnCndSeCd") or "",
                "min": int(p.get("earnMinAmt") or 0),
                "max": int(p.get("earnMaxAmt") or 0),
                "user": int(user.get("income") or 0),
            },
            "education": _intersect(p.get("schoolCd", []), user.get("education", [])),
            "job": _intersect(p.get("jobCd", []), user.get("job", [])),
            "major": _intersect(p.get("plcyMajorCd", []), user.get("major", [])),
            "special": _intersect(p.get("sbizCd", []), user.get("special", [])),
            "keywords": _intersect(p.get("plcyKywdNm", []), user.get("interest_keywords", [])),
        },
    }

def generate_llm_reasons(policies, user, user_intent, model="gpt-4o"):
    payload = []
    for p in policies:
        payload.append({
            "id": p.get("id"),
            "name": p.get("plcyNm"),
            "method": p.get("plcyPvsnMthdCd") or "",
            "support": (p.get("plcySprtCn") or "")[:240],
            "desc": (p.get("plcyExplnCn") or "")[:240],
            "match": {
                "keywords": _intersect(p.get("plcyKywdNm", []), user.get("interest_keywords", [])),
                "age": {
                    "limit": p.get("sprtTrgtAgeLmtYn", "N"),
                    "min": int(p.get("sprtTrgtMinAge") or 0),
                    "max": int(p.get("sprtTrgtMaxAge") or 0),
                    "user": int(user.get("age") or 0),
                },
                "income": {
                    "type": p.get("earnCndSeCd") or "",
                    "min": int(p.get("earnMinAmt") or 0),
                    "max": int(p.get("earnMaxAmt") or 0),
                    "user": int(user.get("income") or 0),
                },
                "education": _intersect(p.get("schoolCd", []), user.get("education", [])),
                "job": _intersect(p.get("jobCd", []), user.get("job", [])),
                "major": _intersect(p.get("plcyMajorCd", []), user.get("major", [])),
                "special": _intersect(p.get("sbizCd", []), user.get("special", [])),
                # 지역은 보내되, 언급은 금지(필요시 한 문구) — 판단은 모델에 맡김
                "region": _intersect(p.get("zipCd", []), user.get("region", []))[:1],
            },
            "intent": user_intent,
            "interests": user.get("interest_keywords", []),
        })

    sys_prompt = (
        "역할: 한국 청년정책 추천 에디터. 사실만 사용해 간결하고 설득력 있는 한국어 문장을 작성.\n"
        "가중치(중요→덜 중요): ①사용자 프롬프트 의도와 관심 키워드 부합 ②정책이 주는 실질적 이점(지원내용·방식) "
        "③연령/소득/자격 적합 ④지역(필요할 때만 한 문구로 간단히). 지역은 가급적 언급하지 마.\n"
        "규칙:\n"
        "1) 출력은 반드시 JSON 배열. 각 원소는 {\"id\": number, \"reason\": string}.\n"
        "2) 한두 문장, 60~110자. 상투어(도와드립니다/이용 가능합니다 등) 금지. 사실 없는 금액·기간·기관명 생성 금지.\n"
        "3) 의도/관심·혜택·요건 중 최소 2가지를 자연스럽게 녹여 써라. 문장 패턴은 다양하게.\n"
    )

    user_prompt = "사용자 의도: " + user_intent + "\n데이터:\n" + json.dumps(payload, ensure_ascii=False)

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": sys_prompt},
                      {"role": "user", "content": user_prompt}],
            temperature=0.5,
            max_tokens=800,
        )
        import re, json as _json
        txt = resp.choices[0].message.content.strip()
        txt = re.sub(r"^```(?:json)?|```$", "", txt, flags=re.MULTILINE).strip()
        arr = _json.loads(txt)
        reasons = {item["id"]: item.get("reason", "") for item in arr if "id" in item}
        for p in policies:
            if p["id"] in reasons and reasons[p["id"]]:
                p["reason"] = reasons[p["id"]]
        return policies
    except Exception as e:
        sys.stderr.write(f"LLM reason 실패: {e}\n")
        return policies


def filtered_policies_to_text(filtered):
    outputSpec = [
        {'key': 'id',                   'desc': '정책 ID'},
        {'key': 'plcyNm',               'desc': '정책명'},
        {'key': 'lclsfNm',              'desc': '정책대분류명'},
        {'key': 'mclsfNm',              'desc': '정책중분류명'},
        {'key': 'plcyKywdNm',           'desc': '정책키워드명'},
        {'key': 'plcyPvsnMthdCd',       'desc': '정책제공방법코드'},
        {'key': 'plcyExplnCn',          'desc': '정책설명내용'},
        {'key': 'plcySprtCn',           'desc': '정책지원내용'},
        {'key': 'sprtSclLmtYn',         'desc': '지원규모제한여부'},
        {'key': 'srngMthdCn',           'desc': '심사방법내용'},
        {'key': 'etcMttrCn',            'desc': '기타사항내용'},
        {'key': 'sprtSclCnt',           'desc': '지원규모수'},
        {'key': 'addAplyQlfcCndCn',     'desc': '추가신청자격조건내용'},
        {'key': 'ptcpPrpTrgtCn',        'desc': '참여제안대상내용'},
        {'key': 'inqCnt',               'desc': '조회수'},
    ]
    result = []
    for idx, p in enumerate(filtered, 1):
        lines = [f"===== [{idx}] 정책 상세 ====="]
        for spec in outputSpec:
            val = p.get(spec['key'], '')
            if isinstance(val, list):
                val = ', '.join(val)
            lines.append(f"{spec['desc']}: {val}")
        result.append('\n'.join(lines))
    return '\n\n'.join(result)

def get_policy_prompt(filtered_txt, user_profile, user_preference, top_n=None):
    policies = [p for p in filtered_txt.strip().split('=====') if p.strip()]
    if top_n is not None:
        selected = policies[:top_n]
    else:
        selected = policies
    content = "\n=====".join(selected)
    user_info = (
        f"나이: {user_profile['age']}세\n"
        f"혼인: {', '.join(user_profile.get('marriage', []))}\n"
        f"소득: {user_profile['income']}\n"
        f"학력: {', '.join(user_profile.get('education', []))}\n"
        f"취업상태: {', '.join(user_profile.get('job', []))}\n"
        f"전공: {', '.join(user_profile.get('major', []))}\n"
        f"특화: {', '.join(user_profile.get('special', []))}\n"
        f"지역: {', '.join(user_profile.get('region', []))}\n"
    )
    interest_keywords = user_profile.get("interest_keywords", [])
    interest_str = ""
    if interest_keywords:
        interest_str = (
            "아래 키워드는 사용자가 **특별히 관심**을 가지는 정책 유형입니다.\n"
            "정책 추천 시 **가장 우선적으로** 고려해 주세요.\n"
            f"▶ 관심 키워드: {', '.join(interest_keywords)}\n"
        )
    prompt = (
        f"다음은 아래 사용자 조건에 필터링된 정책 목록입니다.\n"
        f"--- 사용자 정보 ---\n"
        f"{user_info}"
        f"{interest_str}"
        f"추가 희망 조건: {user_preference}\n"
        f"아래 정책 목록 중에서, 사용자의 정보와 희망 조건, 특히 위의 관심 키워드를 가장 우선적으로 고려하여**정확히 5개의 정책명만** 한국어로, **한 줄에 하나씩** 번호/불릿/설명/머릿말 없이, **정책명만** 줄바꿈(엔터)으로 출력해줘. (정책명 외에는 아무것도 출력하지 마. 쉼표도 사용하지 마.)\n"
        f"아래 목록 **내에서만** 선택해줘. 5개가 안 되면 있는 만큼만, 절대 목록에 없는 이름 만들지 마.\n"
        "=====" + content
        )
    return prompt

def recommend_policy_names(prompt, model="gpt-4o", max_tokens=300):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "당신은 한국의 청년 정책 전문가입니다."},
            {"role": "user", "content": prompt}
                    ],
        temperature=0.7,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content.strip()

def find_policies_by_name(policies, name_list, cutoff=0.85):
    results = []
    for name in name_list:
        found = False
        for policy in policies:
            if difflib.SequenceMatcher(None, policy.get('plcyNm', '').strip(), name).ratio() > cutoff:
                results.append(policy)
                found = True
                break
        if not found:
            sys.stderr.write(f"못 찾은 정책명: {name}\n")
    return results

def build_reason_and_badges(policy, user):
    badges = []
    parts = []

    # 관심 키워드 매칭
    kw = _intersect(policy.get('plcyKywdNm', []), user.get('interest_keywords', []))
    if kw:
        parts.append(f"관심 키워드({', '.join(kw[:2])})와 일치")
        badges.append(f"관심 : {kw[0]}")

    # 제공유형(보조금/대출/바우처/프로그램/공공기관 등)
    method = (policy.get('plcyPvsnMthdCd') or '').strip()
    if method:
        badges.append(method)

    # reason은 3~4개로 제한
    reason = " / ".join(parts[:4]) if parts else "사용자 조건과 부합"
    badges = badges[:3]
    return reason, badges


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python3 recommend.py <user_id> \"<user_preference>\"")
        sys.exit(1)

    user_id = sys.argv[1]
    user_preference = sys.argv[2]
    user_profile = load_user_from_db(user_id)

    policies = load_policies_from_db()

    filtered = filter_policies(policies, user_profile)
    # print(f"필터 후 정책 {len(filtered)}개.")

    filtered_text = filtered_policies_to_text(filtered)
    prompt = get_policy_prompt(filtered_text, user_profile, user_preference, top_n=70)
    policy_names_text = recommend_policy_names(prompt)
    # print("\n=== LLM 추천 정책명 리스트 ===")
    # print(policy_names_text)

    name_list = [name.strip() for name in policy_names_text.split('\n') if name.strip()]
    details = find_policies_by_name(filtered, name_list)
    # print("\n=== 추천 정책 전체 내용 ===")
    # for idx, policy in enumerate(details, 1):
    #    print(f"\n[{idx}]")
    #    for k, v in policy.items():
    #        print(f"{k}: {v}")
    
    for p in details:
        reason, badges = build_reason_and_badges(p, user_profile)
        p['reason'], p['badges'] = reason, badges

    details = generate_llm_reasons(details, user_profile, user_preference)

    print(json.dumps(details, ensure_ascii=False))
