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
const PROVINCES = [
  "서울시",
  "부산시",
  "대구시",
  "인천시",
  "광주시",
  "대전시",
  "울산시",
  "세종시",
  "경기도",
  "강원도",
  "충청북도",
  "충청남도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주도",
];
const CITIES = ["시/도", "강남구", "성동구", "수원시", "용인시", "창원시", "제주시", "기타"];

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
  "고졸",
  "대학 재학",
  "대졸 예정",
  "대학 졸업",
  "대학 석/박사",
];

const MAJOR_OPTIONS = [
  "인문",
  "사회",
  "상경",
  "이학",
  "공학",
  "예체능",
  "농산업",
  "기타",
];

const SPECIAL_GROUP_OPTIONS = [
  "해당없음",
  "중소기업 재직자",
  "한부모가정",
  "장애인",
  "농업인",
  "군인",
  "지역인재",
  "기타",
];

const INTEREST_OPTIONS = [
  "취업",
  "주거",
  "교육",
  "건강/의료",
  "금융",
  "창업",
  "문화/여가",
  "기타",
];

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
  maritalStatus: MaritalStatus;
  employmentStatus: string;
  income: string;
  education: string;
  major: string;
  specialGroup: string[];
  interests: string[];
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
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
    birthDay: "24",
    locationProvince: "서울시",
    locationCity: "",
    maritalStatus: "기혼",
    employmentStatus: "미취업자",
    income: "4000000",
    education: "고졸",
    major: "인문",
    specialGroup: ["해당없음"],
    interests: ["취업"],
  });

  const birthDate = useMemo(() => {
    if (!form.birthYear || !form.birthMonth || !form.birthDay) return "";
    const paddedMonth = form.birthMonth.padStart(2, "0");
    const paddedDay = form.birthDay.padStart(2, "0");
    return `${form.birthYear}-${paddedMonth}-${paddedDay}`;
  }, [form.birthYear, form.birthMonth, form.birthDay]);

  const handleInputChange = (key: keyof SignupFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSpecialGroup = (value: string) => {
    setForm((prev) => {
      const exists = prev.specialGroup.includes(value);
      let updated = exists
        ? prev.specialGroup.filter((item) => item !== value)
        : [...prev.specialGroup, value];

      if (value === "해당없음") {
        updated = ["해당없음"];
      } else {
        updated = updated.filter((item) => item !== "해당없음");
      }

      return { ...prev, specialGroup: updated.length ? updated : ["해당없음"] };
    });
  };

  const toggleInterest = (value: string) => {
    setForm((prev) => {
      const exists = prev.interests.includes(value);
      const updated = exists
        ? prev.interests.filter((item) => item !== value)
        : [...prev.interests, value];
      return { ...prev, interests: updated.length ? updated : [] };
    });
  };

  const handleCheckEmail = async () => {
    if (!form.email) return;
    setEmailStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
      if (!res.ok) {
        throw new Error("이메일 중복");
      }
      setEmailStatus("success");
    } catch (err) {
      console.error(err);
      setEmailStatus("error");
    }
  };

  const handleCheckNickname = async () => {
    if (!form.nickname) return;
    setNicknameStatus("checking");
    try {
      const res = await fetch(
        `/api/auth/check-nickname?nickname=${encodeURIComponent(form.nickname)}`,
      );
      if (!res.ok) {
        throw new Error("닉네임 중복");
      }
      setNicknameStatus("success");
    } catch (err) {
      console.error(err);
      setNicknameStatus("error");
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!form.email || !form.password || !form.passwordConfirm) {
        setError("필수 정보를 입력해주세요.");
        return false;
      }
      if (form.password !== form.passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.");
        return false;
      }
    }

    if (currentStep === 2) {
      if (!birthDate || !form.locationProvince || !form.nickname) {
        setError("생년월일, 거주 지역, 닉네임을 확인해주세요.");
        return false;
      }
    }

    if (currentStep === 3) {
      if (!form.employmentStatus || !form.income || !form.education || !form.major) {
        setError("개인 정보를 모두 입력해주세요.");
        return false;
      }
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
        location: `${form.locationProvince} ${form.locationCity}`.trim(),
        income: Number(form.income || 0),
        maritalStatus: form.maritalStatus,
        education: form.education,
        major: form.major,
        employmentStatus: form.employmentStatus ? [form.employmentStatus] : [],
        specialGroup: form.specialGroup,
        interests: form.interests,
      };

      const res = await fetch(`/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("회원가입에 실패했습니다. 입력 정보를 확인해주세요.");
      }

      const data = (await res.json()) as {
        token: string;
        refreshToken: string;
        expires_in: number;
      };

      setAuthCookies({
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresIn: data.expires_in,
      });

      setStep(4);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "회원가입 요청 중 문제가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;

    if (step === 3) {
      await handleSignupSubmit();
      return;
    }

    setStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

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

            {step === 2 && (
              <div className="space-y-7">
                <h3 className="text-lg font-bold text-[#1f2735]">기본 정보 입력</h3>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#4a5260]">생년월일</p>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                      value={form.birthYear}
                      onChange={(e) => handleInputChange("birthYear", e.target.value)}
                    >
                      <option value="">연도</option>
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year} 년
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                      value={form.birthMonth}
                      onChange={(e) => handleInputChange("birthMonth", e.target.value)}
                    >
                      <option value="">월</option>
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>
                          {month} 월
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                      value={form.birthDay}
                      onChange={(e) => handleInputChange("birthDay", e.target.value)}
                    >
                      <option value="">일</option>
                      {DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day} 일
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#4a5260]">거주 지역</p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                      value={form.locationProvince}
                      onChange={(e) => handleInputChange("locationProvince", e.target.value)}
                    >
                      <option value="">시/도</option>
                      {PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                      value={form.locationCity}
                      onChange={(e) => handleInputChange("locationCity", e.target.value)}
                    >
                      <option value="">시/군/구</option>
                      {CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
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

                <p className="text-xs text-[#7b8292]">
                  모든 정보는 맞춤형 정책 추천을 위해서만 이용됩니다.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-7">
                <h3 className="text-lg font-bold text-[#1f2735]">개인 정보 입력</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#4a5260]">혼인여부</p>
                    <div className="flex gap-3">
                      {["기혼", "미혼"].map((status) => (
                        <TogglePill
                          key={status}
                          label={status}
                          active={form.maritalStatus === status}
                          onClick={() => handleInputChange("maritalStatus", status)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#4a5260]">취업 상태</p>
                      <select
                        className="h-11 w-full rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                        value={form.employmentStatus}
                        onChange={(e) => handleInputChange("employmentStatus", e.target.value)}
                      >
                        <option value="">선택</option>
                        {EMPLOYMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#4a5260]">소득 수준</p>
                      <input
                        className="h-11 w-full rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] outline-none transition focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                        value={form.income}
                        onChange={(e) => handleInputChange("income", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="4,000,000"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#4a5260]">학력 수준</p>
                      <select
                        className="h-11 w-full rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                        value={form.education}
                        onChange={(e) => handleInputChange("education", e.target.value)}
                      >
                        <option value="">선택</option>
                        {EDUCATION_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#4a5260]">전공 계열</p>
                      <select
                        className="h-11 w-full rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
                        value={form.major}
                        onChange={(e) => handleInputChange("major", e.target.value)}
                      >
                        <option value="">선택</option>
                        {MAJOR_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-[#4a5260]">특화요건</p>
                  <div className="flex flex-wrap gap-3">
                    {SPECIAL_GROUP_OPTIONS.map((option) => (
                      <TogglePill
                        key={option}
                        label={option}
                        active={form.specialGroup.includes(option)}
                        onClick={() => toggleSpecialGroup(option)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-[#4a5260]">관심 분야</p>
                  <div className="flex flex-wrap gap-3">
                    {INTEREST_OPTIONS.map((option) => (
                      <TogglePill
                        key={option}
                        label={option}
                        active={form.interests.includes(option)}
                        onClick={() => toggleInterest(option)}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#7b8292]">
                  모든 정보는 맞춤형 정책 추천을 위해서만 이용됩니다.
                </p>
              </div>
            )}

            {error ? (
              <p className="text-sm font-semibold text-[#d64545]">{error}</p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-full max-w-xs rounded-md border border-[#cfd5df] px-6 py-3 text-base font-bold text-[#4a5260] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  이전
                </button>
              ) : null}
              <button
                type="submit"
                className="w-full max-w-xs rounded-md bg-[#2363f3] px-6 py-3 text-base font-bold text-white shadow-[0_10px_20px_rgba(35,99,243,0.28)] transition hover:bg-[#1c55d8] disabled:cursor-not-allowed disabled:bg-[#9bb8ff]"
                disabled={loading}
              >
                {step === 3 ? (loading ? "회원가입 중..." : "회원가입 완료") : loading ? "처리 중..." : "다음"}
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full max-w-3xl rounded-3xl bg-white/70 px-10 py-16 text-center shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col items-center gap-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#e8f0ff] text-5xl text-[#2f6bff] shadow-[0_12px_24px_rgba(47,107,255,0.18)]">
                ✓
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-[#1f2735]">회원가입 단계가 모두 완료되었습니다.</h3>
                <p className="text-xs text-[#7b8292]">
                  모든 정보는 맞춤형 정책 추천을 위해서만 이용됩니다.
                </p>
              </div>
              <button
                type="button"
                className="w-full max-w-xs rounded-md bg-[#2363f3] px-6 py-3 text-base font-bold text-white shadow-[0_10px_20px_rgba(35,99,243,0.28)] transition hover:bg-[#1c55d8]"
                onClick={() => router.push("/auth/signin")}
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
