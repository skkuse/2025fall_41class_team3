import os
import sys
import pymysql
from dotenv import load_dotenv
import json

load_dotenv()

def split_field(val):
    if not val or val.strip() in ["제한없음", "무관"]:
        return []
    return [v.strip() for v in val.split(",") if v.strip()]

def preprocess_policy_row(policy):
    for key in ["zipCd", "mrgSttsCd", "schoolCd", "jobCd", "plcyMajorCd", "sbizCd", "plcyKywdNm"]:
        policy[key] = split_field(policy.get(key, ""))
    for k in ["sprtTrgtMinAge", "sprtTrgtMaxAge", "earnMinAmt", "earnMaxAmt"]:
        try:
            policy[k] = int(policy.get(k) or 0)
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
            rows = cursor.fetchall()
            return [preprocess_policy_row(p) for p in rows]

def multi_field_match(policy_list, filter_list):
    if not policy_list or any(p in ["제한없음", "무관", "", None] for p in policy_list):
        return True
    if not filter_list or "*" in filter_list:
        return True
    for f in filter_list:
        for p in policy_list:
            if f and p and (f in p or p in f):
                return True
    return False

def filter_policies(policies, filters):
    keyword = filters.get("keyword", "").lower()
    sido = filters.get("sido")
    employmentStatus = filters.get("employmentStatus")
    maritalStatus = filters.get("maritalStatus")
    education = filters.get("education")
    major = filters.get("major")
    specialGroup = filters.get("specialGroup", [])
    interests = filters.get("interests", [])

    filtered = []
    for p in policies:
        if keyword and keyword not in p.get("plcyNm", "").lower():
            continue
        if sido and not multi_field_match(p.get("zipCd", []), [sido]):
            continue
        if maritalStatus and not multi_field_match(p.get("mrgSttsCd", []), [maritalStatus]):
            continue
        if education and not multi_field_match(p.get("schoolCd", []), [education]):
            continue
        if employmentStatus and not multi_field_match(p.get("jobCd", []), [employmentStatus]):
            continue
        if major and not multi_field_match(p.get("plcyMajorCd", []), [major]):
            continue
        if specialGroup and not multi_field_match(p.get("sbizCd", []), specialGroup):
            continue
        if interests and not multi_field_match(p.get("plcyKywdNm", []), interests):
            continue

        filtered.append(p)
    return filtered

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise Exception("사용법: python3 search_v2.py '{json_str}'")

        filters = json.loads(sys.argv[1])
        policies = load_policies_from_db()
        result = filter_policies(policies, filters)

        # 정책명만 리스트로 반환
        output = [{ "id": p.get("id"), "plcyNm": p.get("plcyNm", "(정책명 없음)") } for p in result]
        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({ "error": str(e) }, ensure_ascii=False))
        sys.exit(1)
