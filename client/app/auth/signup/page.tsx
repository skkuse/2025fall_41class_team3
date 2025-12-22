"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/common/InputField";
import SignupStepper from "@/components/auth/SignupStepper";
import TogglePill from "@/components/common/TogglePill";
import { setAuthCookies } from "@/lib/auth/tokenClient";

const STEPS = [
  { id: 1, label: "이메일/비밀번호" },
  { id: 2, label: "기본 정보 입력" },
  { id: 3, label: "개인 정보 입력" },
  { id: 4, label: "완료" },
];

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "아이디로 사용할 이메일과 비밀번호를 입력해주세요.",
  2: "생년월일, 거주 지역을 입력해주세요.",
  3: "학력 정보, 혼인여부 등을 입력해주세요.",
  4: "회원가입 단계가 모두 완료되었습니다.",
};

const YEARS = Array.from({ length: 60 }, (_, i) => `${1965 + i}`);
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
const DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}`);


const EMPLOYMENT_OPTIONS = [
  "재직자",
  "자영업자",
  "미취업자",
  "프리랜서",
  "일용근로자",
  "(예비)창업자",
  "단기근로자",
  "영농종사자",
  "기타",
];

const EDUCATION_OPTIONS = [
  "고졸 미만",
  "고교 재학",
  "고교 졸업",
  "대학 재학",
  "대졸 예정",
  "대학 졸업",
  "대학 석/박사",
];

const MAJOR_OPTIONS = [
  "인문계열",
  "사회계열",
  "상경계열",
  "이학계열",
  "공학계열",
  "예체능계열",
  "농산업계열",
  "기타",
];

const SPECIAL_GROUP_OPTIONS = [
  "중소기업",
  "여성",
  "기초생활수급자",
  "한부모가정",
  "장애인",
  "농업인",
  "군인",
  "지역인재",
  "기타",
];

const INTEREST_OPTIONS = [
  "대출",
  "보조금",
  "바우처",
  "금리혜택",
  "교육지원",
  "맞춤형상담서비스",
  "인턴",
  "벤처",
  "중소기업",
  "청년가장",
  "장기미취업청년",
  "공공임대주택",
  "신용회복",
  "육아",
  "출산",
  "해외진출",
  "주거지원",
];

//하드코딩
const REGION_TREE: Record<string, Record<string, string[]>> = {
  '서울특별시': {
    '종로구': [],
    '중구': [],
    '용산구': [],
    '성동구': [],
    '광진구': [],
    '동대문구': [],
    '중랑구': [],
    '성북구': [],
    '강북구': [],
    '도봉구': [],
    '노원구': [],
    '은평구': [],
    '서대문구': [],
    '마포구': [],
    '양천구': [],
    '강서구': [],
    '구로구': [],
    '금천구': [],
    '영등포구': [],
    '동작구': [],
    '관악구': [],
    '서초구': [],
    '강남구': [],
    '송파구': [],
    '강동구': [],
  },

  '부산광역시': {
    '중구': [],
    '서구': [],
    '동구': [],
    '영도구': [],
    '부산진구': [],
    '동래구': [],
    '남구': [],
    '북구': [],
    '해운대구': [],
    '사하구': [],
    '금정구': [],
    '강서구': [],
    '연제구': [],
    '수영구': [],
    '사상구': [],
    '기장군': [],
  },

  '대구광역시': {
    '중구': [],
    '동구': [],
    '서구': [],
    '남구': [],
    '북구': [],
    '수성구': [],
    '달서구': [],
    '달성군': [],
  },

  '인천광역시': {
    '중구': [],
    '동구': [],
    '미추홀구': [],
    '연수구': [],
    '남동구': [],
    '부평구': [],
    '계양구': [],
    '서구': [],
    '강화군': [],
    '옹진군': [],
  },

  '광주광역시': {
    '동구': [],
    '서구': [],
    '남구': [],
    '북구': [],
    '광산구': [],
  },

  '대전광역시': {
    '동구': [],
    '중구': [],
    '서구': [],
    '유성구': [],
    '대덕구': [],
  },

  '울산광역시': {
    '중구': [],
    '남구': [],
    '동구': [],
    '북구': [],
    '울주군': [],
  },

  '세종특별자치시': {
    '세종특별자치시': [],
  },

  '경기도': {
    '수원시': ['장안구', '권선구', '팔달구', '영통구'],
    '성남시': ['수정구', '중원구', '분당구'],
    '안양시': ['만안구', '동안구'],
    '부천시': ['중구', '원미구', '남구', '소사구', '오정구'],
    '안산시': ['상록구', '단원구'],
    '고양시': ['덕양구', '일산동구', '일산서구'],
    '용인시': ['처인구', '기흥구', '수지구'],
    '의정부시': [],
    '광명시': [],
    '평택시': [],
    '동두천시': [],
    '과천시': [],
    '구리시': [],
    '남양주시': [],
    '오산시': [],
    '시흥시': [],
    '군포시': [],
    '의왕시': [],
    '하남시': [],
    '파주시': [],
    '이천시': [],
    '안성시': [],
    '김포시': [],
    '화성시': [],
    '광주시': [],
    '여주시': [],
    '양평군': [],
    '연천군': [],
    '포천시': [],
    '가평군': [],
  },

  '강원도': {
    '춘천시': [],
    '원주시': [],
    '강릉시': [],
    '동해시': [],
    '태백시': [],
    '속초시': [],
    '삼척시': [],
    '홍천군': [],
    '횡성군': [],
    '영월군': [],
    '평창군': [],
    '정선군': [],
    '철원군': [],
    '화천군': [],
    '양구군': [],
    '인제군': [],
    '고성군': [],
    '양양군': [],
  },

  '충청북도': {
    '청주시': ['상당구', '서원구', '흥덕구', '청원구'],
    '충주시': [],
    '제천시': [],
    '보은군': [],
    '옥천군': [],
    '영동군': [],
    '증평군': [],
    '진천군': [],
    '괴산군': [],
    '음성군': [],
    '단양군': [],
  },

  '충청남도': {
    '천안시': ['동남구', '서북구'],
    '공주시': [],
    '보령시': [],
    '아산시': [],
    '서산시': [],
    '논산시': [],
    '계룡시': [],
    '당진시': [],
    '금산군': [],
    '부여군': [],
    '서천군': [],
    '청양군': [],
    '홍성군': [],
    '예산군': [],
    '태안군': [],
  },

  '전라북도': {
    '전주시': ['완산구', '덕진구'],
    '군산시': [],
    '익산시': [],
    '정읍시': [],
    '남원시': [],
    '김제시': [],
    '완주군': [],
    '진안군': [],
    '무주군': [],
    '장수군': [],
    '임실군': [],
    '순창군': [],
    '고창군': [],
    '부안군': [],
  },

  '전라남도': {
    '목포시': [],
    '여수시': [],
    '순천시': [],
    '나주시': [],
    '광양시': [],
    '담양군': [],
    '곡성군': [],
    '구례군': [],
    '고흥군': [],
    '보성군': [],
    '화순군': [],
    '장흥군': [],
    '강진군': [],
    '해남군': [],
    '영암군': [],
    '무안군': [],
    '함평군': [],
    '영광군': [],
    '장성군': [],
    '완도군': [],
    '진도군': [],
    '신안군': [],
  },

  '경상북도': {
    '포항시': ['남구', '북구'],
    '경주시': [],
    '김천시': [],
    '안동시': [],
    '구미시': [],
    '영주시': [],
    '영천시': [],
    '상주시': [],
    '문경시': [],
    '경산시': [],
    '군위군': [],
    '의성군': [],
    '청송군': [],
    '영양군': [],
    '영덕군': [],
    '청도군': [],
    '고령군': [],
    '성주군': [],
    '칠곡군': [],
    '예천군': [],
    '봉화군': [],
    '울진군': [],
    '울릉군': [],
  },

  '경상남도': {
    '창원시': ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
    '진주시': [],
    '통영시': [],
    '사천시': [],
    '김해시': [],
    '밀양시': [],
    '거제시': [],
    '양산시': [],
    '의령군': [],
    '함안군': [],
    '창녕군': [],
    '고성군': [],
    '남해군': [],
    '하동군': [],
    '산청군': [],
    '함양군': [],
    '거창군': [],
    '합천군': [],
  },

  '제주특별자치도': {
    '제주시': [],
    '서귀포시': [],
  },
};



type MaritalStatus = "기혼" | "미혼" | "";

interface SignupFormState {
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  locationProvince: string;
  locationCity: string;
  locationDistrict: string;//optional
  maritalStatus: MaritalStatus;
  employmentStatus: string;
  income: string;
  education: string;
  major: string;
  specialGroup: string[];
  interests: string[];
}

// -------------------------------------------------------
// SignupPage
// -------------------------------------------------------
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "success" | "error">("idle");

  const [form, setForm] = useState<SignupFormState>({
    email: "",
    password: "",
    passwordConfirm: "",
    nickname: "",
    birthYear: "2002",
    birthMonth: "7",
    birthDay: "23",
    locationProvince: "서울특별시",
    locationCity: "",
    locationDistrict: "",
    maritalStatus: "미혼",
    employmentStatus: "미취업자",
    income: "0",
    education: "고교 졸업",
    major: "공학계열",
    specialGroup: [],
    interests: [],
  });

  const birthDate = useMemo(() => {
    if (!form.birthYear || !form.birthMonth || !form.birthDay) return "";
    const mm = form.birthMonth.padStart(2, "0");
    const dd = form.birthDay.padStart(2, "0");
    return `${form.birthYear}-${mm}-${dd}`;
  }, [form.birthYear, form.birthMonth, form.birthDay]);

  const handleInputChange = (key: keyof SignupFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSpecialGroup = (value: string) => {
    setForm((prev) => {
      const exists = prev.specialGroup.includes(value);
      const updated = exists
        ? prev.specialGroup.filter((v) => v !== value)
        : [...prev.specialGroup, value];
      return { ...prev, specialGroup: updated };
    });
  };

  const toggleInterest = (value: string) => {
    setForm((prev) => {
      const exists = prev.interests.includes(value);
      const updated = exists
        ? prev.interests.filter((v) => v !== value)
        : [...prev.interests, value];
      return { ...prev, interests: updated };
    });
  };

  // 이메일 / 닉네임 검증
  const handleCheckEmail = async () => {
    if (!form.email) return;
    setEmailStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
      if (res.status === 409) {
        setEmailStatus("error");
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json?.data?.exists) {
        setEmailStatus("error");
      } else {
        setEmailStatus("success");
      }
    } catch {
      setEmailStatus("error");
    }
  }; 

  const handleCheckNickname = async () => {
    if (!form.nickname) return;
    setNicknameStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(form.nickname)}`);
      if (!res.ok) {
        // server may return 400 for blacklist or other validation
        throw new Error();
      }
      const json = await res.json();
      if (json?.data?.exists) {
        setNicknameStatus("error");
      } else {
        setNicknameStatus("success");
      }
    } catch {
      setNicknameStatus("error");
    }
  };

  // 단계 검증
  const validateStep = (current: number) => {
    if (current === 1) {
      if (!form.email || !form.password || !form.passwordConfirm)
        return setError("필수 정보를 입력해주세요."), false;
      if (form.password !== form.passwordConfirm)
        return setError("비밀번호가 일치하지 않습니다."), false;
    }

    if (current === 2) {
      if (!birthDate || !form.locationProvince)
        return setError("생년월일, 거주 지역, 닉네임을 확인해주세요."), false;
    }

    if (current === 3) {
      if (!form.education || !form.major || !form.employmentStatus)
        return setError("개인 정보를 모두 입력해주세요."), false;
    }

    setError(null);
    return true;
  };

  const handleSignupSubmit = async () => {
    setLoading(true);

    try {
      const payload = {
        email: form.email,
        password: form.password,
        nickname: form.nickname,
        birthDate,
        location: [
                    form.locationProvince,
                    form.locationCity,
                    form.locationDistrict,
                  ].filter(Boolean).join(" "),

        income: Number(form.income || 0),

        maritalStatus: form.maritalStatus,
        education: form.education,
        major: form.major,

        employmentStatus: [form.employmentStatus], 

        specialGroup: [...form.specialGroup],
        interests: [...form.interests],
      };

      const res = await fetch(`/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("회원가입에 실패했습니다.");

      const data = await res.json();

      setAuthCookies({
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expires_in,
      });

      setStep(4);
    } catch (e) {
      setError("회원가입 요청 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;
    if (step === 3) return handleSignupSubmit();
    setStep((prev) => prev + 1);
  };

  const handlePrev = () => setStep((prev) => Math.max(1, prev - 1));

  const renderStatusText = (status: typeof emailStatus) => {
    if (status === "success") return <span className="text-xs font-semibold text-[#2f6bff]">사용 가능</span>;
    if (status === "error") return <span className="text-xs font-semibold text-[#d64545]">중복된 값입니다.</span>;
    if (status === "checking") return <span className="text-xs text-[#5b6372]">확인 중...</span>;
    return null;
  };

  return (
    <AuthLayout title="회원가입" description={STEP_DESCRIPTIONS[step]}>
      <div className="flex flex-col items-center gap-8">

        <SignupStepper steps={STEPS} currentStep={step} />

        {step <= 3 ? (
          <form
            className="w-full max-w-3xl space-y-7 rounded-3xl bg-white/70 px-10 py-12 shadow-[0_18px_40px_rgba(0,0,0,0.06)]"
            onSubmit={handleNext}
          >
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-[#1f2735]">이메일/비밀번호</h3>

                <InputField
                  label="이메일"
                  actionLabel="중복 확인"
                  onAction={handleCheckEmail}
                  helper={renderStatusText(emailStatus)}
                  inputProps={{
                    type: "email",
                    placeholder: "이메일을 입력해 주세요.",
                    value: form.email,
                    onChange: (e) => handleInputChange("email", e.target.value),
                  }}
                />

                <InputField
                  label="비밀번호"
                  inputProps={{
                    type: "password",
                    placeholder: "비밀번호를 입력해 주세요.",
                    value: form.password,
                    onChange: (e) => handleInputChange("password", e.target.value),
                  }}
                />

                <InputField
                  label="비밀번호 확인"
                  inputProps={{
                    type: "password",
                    placeholder: "비밀번호를 한 번 더 입력해 주세요.",
                    value: form.passwordConfirm,
                    onChange: (e) => handleInputChange("passwordConfirm", e.target.value),
                  }}
                />
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-7">
                <h3 className="text-lg font-bold text-[#1f2735]">기본 정보 입력</h3>

                {/* 생년월일 */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#4a5260]">생년월일</p>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                      value={form.birthYear}
                      onChange={(e) => handleInputChange("birthYear", e.target.value)}
                    >
                      <option value="">연도</option>
                      {YEARS.map((year) => (
                        <option key={year}>{year}</option>
                      ))}
                    </select>

                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                      value={form.birthMonth}
                      onChange={(e) => handleInputChange("birthMonth", e.target.value)}
                    >
                      <option value="">월</option>
                      {MONTHS.map((month) => (
                        <option key={month}>{month}</option>
                      ))}
                    </select>

                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                      value={form.birthDay}
                      onChange={(e) => handleInputChange("birthDay", e.target.value)}
                    >
                      <option value="">일</option>
                      {DAYS.map((day) => (
                        <option key={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 지역 */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#4a5260]">거주 지역</p>

                  <div className="grid grid-cols-3 gap-3">

                    {/* 시/도 */}
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                      value={form.locationProvince}
                      onChange={(e) => {
                        handleInputChange("locationProvince", e.target.value);
                        handleInputChange("locationCity", "");
                        handleInputChange("locationDistrict", "");
                      }}
                    >
                      <option value="">시/도</option>
                      {Object.keys(REGION_TREE).map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>

                    {/* 시 / 군 */}
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                      value={form.locationCity}
                      onChange={(e) => {
                        handleInputChange("locationCity", e.target.value);
                        handleInputChange("locationDistrict", "");
                      }}
                      disabled={!form.locationProvince}
                    >
                      <option value="">시/군</option>
                      {Object.keys(
                        REGION_TREE[form.locationProvince] || {}
                      ).map((city) => (
                        <option key={city}>{city}</option>
                      ))}
                    </select>

                    {/* 구 (있는 경우만) */}
                    {(
                      REGION_TREE[form.locationProvince]?.[form.locationCity]?.length ?? 0
                    ) > 0 && (
                      <select
                        className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm"
                        value={form.locationDistrict}
                        onChange={(e) =>
                          handleInputChange("locationDistrict", e.target.value)
                        }
                      >
                        <option value="">구</option>
                        {REGION_TREE[form.locationProvince][form.locationCity].map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>


                <InputField
                  label="닉네임"
                  actionLabel="중복 확인"
                  onAction={handleCheckNickname}
                  helper={renderStatusText(nicknameStatus)}
                  inputProps={{
                    placeholder: "사용하실 닉네임을 입력해 주세요.",
                    value: form.nickname,
                    onChange: (e) => handleInputChange("nickname", e.target.value),
                  }}
                />
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-7">
                <h3 className="text-lg font-bold text-[#1f2735]">개인 정보 입력</h3>

                {/* 혼인 여부 */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">혼인 여부</p>
                  <div className="flex gap-3">
                    {["기혼", "미혼"].map((v) => (
                      <TogglePill
                        key={v}
                        label={v}
                        active={form.maritalStatus === v}
                        onClick={() => handleInputChange("maritalStatus", v)}
                      />
                    ))}
                  </div>
                </div>

                {/* 취업/소득/학력/전공 */}
                <div className="grid grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">취업 상태</p>
                    <select
                      className="h-11 rounded-md border px-3 text-sm"
                      value={form.employmentStatus}
                      onChange={(e) => handleInputChange("employmentStatus", e.target.value)}
                    >
                      <option value="">선택</option>
                      {EMPLOYMENT_OPTIONS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">소득 수준</p>
                    <input
                      className="h-11 rounded-md border px-3 text-sm"
                      value={form.income}
                      onChange={(e) => handleInputChange("income", e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">최종 학력</p>
                    <select
                      className="h-11 rounded-md border px-3 text-sm"
                      value={form.education}
                      onChange={(e) => handleInputChange("education", e.target.value)}
                    >
                      <option value="">선택</option>
                      {EDUCATION_OPTIONS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">전공 계열</p>
                    <select
                      className="h-11 rounded-md border px-3 text-sm"
                      value={form.major}
                      onChange={(e) => handleInputChange("major", e.target.value)}
                    >
                      <option value="">선택</option>
                      {MAJOR_OPTIONS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* 특화요건 */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">특화 분야</p>
                  <div className="flex flex-wrap gap-3">
                    {SPECIAL_GROUP_OPTIONS.map((v) => (
                      <TogglePill
                        key={v}
                        label={v}
                        active={form.specialGroup.includes(v)}
                        onClick={() => toggleSpecialGroup(v)}
                      />
                    ))}
                  </div>
                </div>

                {/* 관심 분야 */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">관심 분야</p>
                  <div className="flex flex-wrap gap-3">
                    {INTEREST_OPTIONS.map((v) => (
                      <TogglePill
                        key={v}
                        label={v}
                        active={form.interests.includes(v)}
                        onClick={() => toggleInterest(v)}
                      />
                    ))}
                  </div>
                </div>

              </div>
            )}

            {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}

            {/* 버튼 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-full max-w-xs rounded-md border px-6 py-3 font-bold"
                >
                  이전
                </button>
              )}

              <button
                type="submit"
                className="w-full max-w-xs rounded-md bg-blue-600 px-6 py-3 font-bold text-white"
                disabled={loading}
              >
                {step === 3 ? (loading ? "회원가입 중..." : "회원가입 완료") : "다음"}
              </button>
            </div>
          </form>
        ) : (
          // STEP 4 완료 화면
          <div className="w-full max-w-3xl rounded-3xl bg-white/70 px-10 py-16 text-center shadow">
            <div className="flex flex-col items-center gap-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-5xl text-blue-600">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-bold">회원가입 완료</h3>
                <p className="text-xs text-gray-500">
                  모든 정보는 맞춤형 정책 추천을 위해서만 이용됩니다.
                </p>
              </div>
              <button
                className="w-full max-w-xs rounded-md bg-blue-600 px-6 py-3 font-bold text-white"
                onClick={() => router.push("/")}
              >
                시작하기
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

