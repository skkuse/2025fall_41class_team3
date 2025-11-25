# mypage 페이지 PRD

## UI 구조 : figma mcp 활용하여 완벽히 동일하게 구현할 것

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=148-1107&m=dev
-> 개인정보수정 버튼 클릭 전, readOnly 상태 true

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=130-75&m=dev
-> 개인정보수정 버튼 클릭 후, readOnly 상태 false


## API endpoints
API base URL : .env의 API_BASE_URL 사용

**get/api/mypage/basic**
- JWT 토큰을 통해 인증된 사용자의 기본 정보를 조회합니다.
- mypage 페이지 진입 시 정보 받아와서 보여줌

**get/api/mypage/detail**
- JWT 토큰을 통해 인증된 사용자의 상세 정보를 조회합니다.
- mypage 페이지 진입 시 정보 받아와서 basic 정보 아래에 이어서 보여줌

**put/api/mypage/edit**
- JWT 토큰을 통해 인증된 사용자의 개인정보를 수정합니다.
- 개인정보수정완료 버튼 클릭 시 trigger


## Components Description

# mypage : 기본 정보를 조회·수정하여, LLM 및 추천 알고리즘이 더 정확한 결과를 제공할 수 있도록 하는 페이지

## 1. 상단 프로필 카드
- 이름
- 이메일
- 생년월일 (birthDate) -> readOnly ? (태그 형태) : (dropdown)
- 거주 지역 (location) -> readOnly ? (태그 형태) : (dropdown)

## 2. 개인 정보 섹션
### 표시 항목
- 소득 (income)
- 혼인 여부 (maritalStatus)
- 최종 학력 (education)
- 전공 (major)
- 취업 상태 (employmentStatus[]) -> readOnly ? (태그 형태) : (dropdown)
- 특화 그룹 (specialGroup[]) -> readOnly ? (태그 형태) : (dropdown)
- 관심 분야 (interests[]) -> readOnly ? (태그 형태) : (dropdown)

## 3. 정보 수정 버튼
readOnly state=false 로 전환


## 구현 시 주의사항 : dropdown 및 multiple selection의 선택지는 이미지에 나와있는대로가 아닌, 아래 schema를 참고할것
  혼인 여부 (maritalStatus)
  취업 상태 (employmentStatus[]): '재직자', '자영업자', '미취업자', '프리랜서', '일용근로자', '(예비)창업자', '단기근로자', '영농종사자', '기타'
  월평균 소득 (income, 숫자 입력, 단위 : 원)
  학력 수준 (education) : '고졸 미만', '고교 재학', '고교 졸업', '대학 재학', '대졸 예정', '대학 졸업', '대학 석/박사'
  전공 계열 (major) : '인문계열', '사회계열', '상경계열', '이학계열', '공학계열', '예체능계열', '농산업계열', '기타'
  특화 그룹 (specialGroup[]): '중소기업', '여성', '기초생활수급자', '한부모가정', '장애인', '농업인', '군인', '지역인재', '기타'
  관심 분야 (interests[]): '대출', '보조금', '바우처', '금리혜택', '교육지원', '맞춤형상담서비스', '인턴', '벤처', '중소기업', '청년가장', '장기미취업청년', '공공임대주택', '신용회복', '육아', '출산', '해외진출', '주거지원',