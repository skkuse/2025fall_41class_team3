import os
import sys
import pymysql
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()

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

    user["region"] = split_field(user["location"]) if user.get("location") else []
    user["marriage"] = split_field(user["maritalStatus"]) if user.get("maritalStatus") else []
    user["education"] = split_field(user["education"]) if user.get("education") else []
    user["job"] = split_field(user["job"]) if user.get("job") else []
    user["major"] = split_field(user["major"]) if user.get("major") else []
    user["special"] = json.loads(user["specialGroup"]) if user.get("specialGroup") else []
    user["interest_keywords"] = json.loads(user["interests"]) if user.get("interests") else []

    if user.get("birthDate") and str(user["birthDate"]) != "0000-00-00":
        birth = datetime.strptime(str(user["birthDate"]), "%Y-%m-%d")
        today = datetime.today()
        user["age"] = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    else:
        user["age"] = 0

    user["income"] = int(user["income"]) if user.get("income") else 0

    return user

def multi_field_match(policy_list, user_list):
    if not policy_list or any(p in ["제한없음", "무관", "", None] for p in policy_list):
        return True
    if not user_list:
        return True
    for u in user_list:
        for p in policy_list:
            if u and p and (u in p or p in u):
                return True
    return False

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

def filtered_policies_to_text(filtered):
    outputSpec = [
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


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python3 recommend.py <user_id>")
        sys.exit(1)

    user_id = sys.argv[1]
    user_profile = load_user_from_db(user_id)

    policies = load_policies_from_db()

    filtered = filter_policies(policies, user_profile)
    print(f"\n필터 후 정책 {len(filtered)}개.\n")

    # 필터링된 정책명 출력
    print("=== 필터링된 정책명 리스트 ===")
    for i, policy in enumerate(filtered, 1):
        print(f"[{i}] {policy.get('plcyNm', '(정책명 없음)')}")

    # 정책 상세 내용 출력
    print("\n=== 필터링된 정책 상세 내용 ===")
    for idx, policy in enumerate(filtered, 1):
        print(f"\n[{idx}]")
        for k, v in policy.items():
            if isinstance(v, list):
                v = ', '.join(v)
            print(f"{k}: {v}")
