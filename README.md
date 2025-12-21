# Policy RAG (팀 프로젝트)

**간단 소개** ✅

이 저장소는 정책 문서 기반의 RAG(Retrieval-Augmented Generation) 웹 애플리케이션입니다. 프론트엔드(Next.js)와 백엔드(Express), 그리고 일부 Python 스크립트(요약·추천·검색)를 포함합니다.

---

## 빠른 시작 🔧

### 1) 레포 클론

```bash
git clone <repo-url>
cd 2025fall_41class_team3
```

### 2) 서버 설치 및 실행 (백엔드)

```bash
cd server
npm install
# .env 파일 설정 (예: DB, JWT secret 등)
npm run dev
```

- 개발 서버가 `nodemon`으로 `index.js` 를 실행합니다.
- 환경 변수는 `server/.env` (프로젝트 루트에 `.env`가 있는 경우) 파일에 설정하세요.
- DB 초기화는 `server/scripts/init_db.js`를 사용합니다.

### 3) 클라이언트 설치 및 실행 (프론트엔드)

```bash
cd client
npm install
npm run dev
# 기본적으로 Next.js 개발 서버가 실행됩니다.
```

### 4) Python 유틸

- `server/python` 폴더에 있는 `policy_summary.py`, `recommend.py`, `search.py` 등은 문서 요약 및 임베딩·검색/추천에 사용됩니다.
- Python 가상환경을 만들고 `requirements.txt`(없다면 필요한 패키지)를 설치한 후 실행하세요.

---

## 주요 디렉토리 구조 🗂️

```
2025fall_41class_team3/
├─ client/                    # Next.js 프론트엔드
│  ├─ app/                     # Next App 디렉토리 (페이지·API 라우트)
│  │  ├─ api/                  # 클라이언트용 API 라우트(프록시 등)
│  │  ├─ auth/
│  │  └─ mypage/
│  ├─ components/              # UI 컴포넌트
│  ├─ lib/                     # 클라이언트 라이브러리 (auth, server 핸들러)
│  └─ public/
├─ server/                    # Express 백엔드
│  ├─ controllers/             # 라우트 핸들러
│  ├─ routes/                  # Express 라우트 정의
│  ├─ middleware/              # 인증 등 미들웨어
│  ├─ python/                  # 요약·검색·추천용 파이썬 스크립트
│  ├─ scripts/                 # 예: DB 초기화 스크립트
│  ├─ data/                    # 정적 데이터 (예: 법정동 코드)
│  └─ index.js                 # 서버 진입점
├─ docs/                       # 프로젝트 문서 (옵션)
└─ README.md                   # (이 파일)
```

> 필요에 따라 위 구조에 세부 파일(컨트롤러, 라우트, 컴포넌트 등)이 추가되어 있습니다. 작업 시 해당 디렉토리의 README 또는 주석을 확인하세요.

---

## 환경변수 (예시) ⚙️

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL 연결 정보
- `JWT_SECRET` — JWT 서명용 시크릿
- 기타 외부 API 키(있다면) 설정 필요

(구체적인 키/값은 `server/config/db.js`와 프로젝트 담당자 문서를 참고하세요.)

---

## 유용한 명령어 모음 💡

- 서버 개발: `cd server && npm run dev`
- 클라이언트 개발: `cd client && npm run dev`
- 빌드(프론트): `cd client && npm run build && npm run start`
- DB 초기화: `node server/scripts/init_db.js` (환경변수 확인)

---

## 기여와 코드 스타일 ✨

- PR은 항상 기능 단위로 작게 나누어 올려주세요.
- 자바스크립트/타입스크립트 스타일은 각 폴더의 ESLint/TS 설정을 따릅니다 (`client`는 Next.js 기반). 

---

## 문의 📩

프로젝트 관련 문의는 팀 레포 이슈(issue)를 이용하거나 담당자에게 연락하세요.

---

> 필요한 추가 정보(상세 설치 스크립트, CI 설정, 배포 가이드 등)가 있다면 알려주시면 README에 반영해 정리해 드리겠습니다. 😊
