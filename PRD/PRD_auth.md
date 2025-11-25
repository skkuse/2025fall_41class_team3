# auth 페이지 PRD

## UI 구조 : figma mcp 활용하여 완벽히 동일하게 구현할 것

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=129-36&m=dev
-> signin page

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=106-2&m=dev
-> signup page - step1

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=128-85&m=dev
-> signup page - step2

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=128-201&m=dev
-> signup page - step3

https://www.figma.com/design/3ByXbdZSc9oszThrVe9Uyn/%EC%B2%AD%EB%85%84%EC%A0%95%EC%B1%85%EC%B6%94%EC%B2%9C%ED%94%8C%EB%9E%AB%ED%8F%BC?node-id=128-150&m=dev
-> signup page - step4




## API endpoints
API base URL : .env의 API_BASE_URL 사용

**post/api/auth/signup**

**post/api/auth/login**

**post/api/auth/refresh**

**get/api/auth/check-email**

**get/api/auth/check-nickname**

## API request schema
    "/api/auth/signup": {
      "post": {
        "summary": "회원가입",
        "description": "이메일, 비밀번호, 닉네임 등 사용자 정보를 받아 회원가입 처리합니다.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "email",
                  "password",
                  "nickname",
                  "birthDate",
                  "location",
                  "income",
                  "education"
                ],
                "properties": {
                  "email": {
                    "type": "string",
                    "example": "user@example.com"
                  },
                  "password": {
                    "type": "string",
                    "example": "mypassword123"
                  },
                  "nickname": {
                    "type": "string",
                    "example": "홍길동"
                  },
                  "birthDate": {
                    "type": "string",
                    "example": "1995-01-01"
                  },
                  "location": {
                    "type": "string",
                    "example": "서울특별시"
                  },
                  "income": {
                    "type": "integer",
                    "example": 3000000
                  },
                  "maritalStatus": {
                    "type": "string",
                    "example": "미혼"
                  },
                  "education": {
                    "type": "string",
                    "example": "대학교 졸업"
                  },
                  "major": {
                    "type": "string",
                    "example": "컴퓨터공학"
                  },
                  "employmentStatus": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "example": [
                      "재직자"
                    ]
                  },
                  "specialGroup": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "example": [
                      "저소득층"
                    ]
                  },
                  "interests": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "example": [
                      "교육",
                      "금융"
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "회원가입 성공"
          },
          "400": {
            "description": "필수 값 누락"
          },
          "409": {
            "description": "이메일 중복"
          }
        }
      }
    },
    "/api/auth/login": {
      "post": {
        "summary": "로그인",
        "description": "이메일과 비밀번호를 받아 로그인 처리합니다.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": {
                    "type": "string",
                    "example": "user@example.com"
                  },
                  "password": {
                    "type": "string",
                    "example": "mypassword123"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "로그인 성공"
          },
          "401": {
            "description": "로그인 실패"
          }
        }
      }
    },
    "/api/auth/refresh": {
      "post": {
        "summary": "토큰 재발급",
        "description": "리프레시 토큰을 받아 새로운 액세스 토큰을 발급합니다.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "refreshToken": {
                    "type": "string",
                    "example": "abc123xyz456"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "토큰 재발급 성공"
          },
          "400": {
            "description": "리프레시 토큰 없음"
          },
          "401": {
            "description": "유효하지 않은 리프레시 토큰"
          }
        }
      }
    },
    "/api/auth/check-email": {
      "get": {
        "summary": "이메일 중복 확인",
        "parameters": [
          {
            "name": "email",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "중복 여부를 확인할 이메일"
          }
        ],
        "responses": {
          "200": {
            "description": "중복 여부 반환"
          },
          "400": {
            "description": "이메일이 제공되지 않음"
          }
        }
      }
    },
    "/api/auth/check-nickname": {
      "get": {
        "summary": "닉네임 중복 확인",
        "parameters": [
          {
            "name": "nickname",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "중복 여부를 확인할 닉네임"
          }
        ],
        "responses": {
          "200": {
            "description": "중복 여부 반환"
          },
          "400": {
            "description": "닉네임이 제공되지 않음"
          }
        }
      }
    },


## Description

# signin

## 1. 입력 필드
- 이메일
- 비밀번호

## 2. 로그인 버튼
- 닉네임 (중복 체크 버튼 → GET /api/auth/check-nickname)
- 생년월일 (birthDate)
- 거주 지역 (location, 시/도 기준 셀렉트)

## 3. 회원가입 버튼
- 회원가입 상태로 이동

## 액션 / 오류 처리
- “로그인” 버튼 → POST /api/auth/login  
- 성공: 토큰 저장 후  
  - 첫 로그인이라면 → 온보딩(정보 보완 페이지)  
  - 아니면 → Home 페이지

- 오류 처리: 401 → “이메일 또는 비밀번호를 확인해주세요” 토스트/알럿

---

# signup 컴포넌트

## 1. 계정 정보 섹션
- 이메일 (중복 체크 버튼 → GET /api/auth/check-email)
- 비밀번호 / 비밀번호 확인

## 2. 기본 프로필 정보
- 닉네임 (중복 체크 버튼 → GET /api/auth/check-nickname)
- 생년월일 (birthDate)
- 거주 지역 (location, 시/도 기준 셀렉트)

## 3. 경제·학력 정보
- 혼인 여부 (maritalStatus)
- 취업 상태 (employmentStatus[]):  
  ‘재직자’, ‘자영업자’, ‘미취업자’, ‘프리랜서’, ‘일용근로자’, ‘(예비)창업자’, ‘단기근로자’, ‘영농종사자’, ‘기타’
- 월평균 소득 (income, 숫자 입력, 단위: 원)
- 학력 수준 (education):  
  ‘고졸 미만’, ‘고교 재학’, ‘고교 재학’, ‘고졸’,  
  ‘대학 재학’, ‘대졸 예정’, ‘대학 졸업’,  
  ‘대학 석/박사’
- 전공 계열 (major):  
  ‘인문계열’, ‘사회계열’, ‘상경계열’, ‘이학계열’,  
  ‘공학계열’, ‘예체능계열’, ‘농산업계열’, ‘기타’

## 4. 상황/관심 태그 (멀티 선택)
- 특화 그룹 (specialGroup[]):  
  ‘중소기업’, ‘여성’, ‘기초생활수급자’, ‘한부모가정’,  
  ‘장애인’, ‘농업인’, ‘군인’, ‘지역인재’, ‘기타’
- 관심 분야 (interests[]):  
  ‘대출’, ‘보조금’, ‘바우처’, ‘금리혜택’,  
  ‘교육지원’, ‘맞춤형상담서비스’, ‘인턴’, ‘벤처’,  
  ‘중소기업’, ‘청년가점’, ‘장기미취업청년’,  
  ‘공공임대주택’, ‘신용회복’, ‘육아’, ‘출산’,  
  ‘해외진출’, ‘주거지원’, ‘기타’
