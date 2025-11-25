"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AccountInfoCard from "@/components/mypage/AccountInfoCard";
import BasicInfoSection from "@/components/mypage/BasicInfoSection";
import PageHeader from "@/components/mypage/PageHeader";
import PersonalInfoSection from "@/components/mypage/PersonalInfoSection";
import SectionCard from "@/components/mypage/SectionCard";
import SideNav from "@/components/home/SideNav";
import { fetchWithAuth } from "@/lib/auth/apiClient";
import { clearAuthCookies, getAccessToken } from "@/lib/auth/tokenClient";

interface BasicResponse {
  email?: string;
  nickname?: string;
  birthDate?: string;
  location?: string;
}

interface DetailResponse {
  income?: number;
  maritalStatus?: string;
  education?: string;
  major?: string;
  employmentStatus?: string[];
  specialGroup?: string[];
  interests?: string[];
  tags?: Record<string, string[] | undefined>;
}

export default function MyPage() {
  const router = useRouter();
  const [readOnly, setReadOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [location, setLocation] = useState("");
  const [nickname, setNickname] = useState("");

  const [maritalStatus, setMaritalStatus] = useState<string | undefined>(undefined);
  const [employmentStatus, setEmploymentStatus] = useState<string[]>([]);
  const [education, setEducation] = useState<string | undefined>(undefined);
  const [major, setMajor] = useState<string | undefined>(undefined);
  const [income, setIncome] = useState<number | "">("");
  const [specialGroup, setSpecialGroup] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const birthDate = useMemo(() => {
    if (!birthYear || !birthMonth || !birthDay) return "";
    return `${birthYear}-${birthMonth}-${birthDay}`;
  }, [birthYear, birthMonth, birthDay]);

  const parseBirthDate = (value?: string) => {
    if (!value) return { y: "", m: "", d: "" };
    const [datePart] = value.split("T");
    const [y, m, d] = (datePart || value).split("-");
    const pad = (v?: string) => (v ? v.padStart(2, "0") : "");
    return { y: y || "", m: pad(m), d: pad(d) };
  };

  const normalizeArray = (input?: unknown) => {
    if (!Array.isArray(input)) return [] as string[];
    return input.map((v) => `${v || ""}`.trim()).filter((v) => v.length > 0);
  };

  const loadData = async () => {
    try {
      setError(null);
      setInfoMessage(null);
      setLoading(true);
      const [basicRes, detailRes] = await Promise.all([
        fetchWithAuth("/api/mypage/basic"),
        fetchWithAuth("/api/mypage/detail"),
      ]);

      console.log("[mypage] detail response status", detailRes.status);
      try {
        const detailPreview = await detailRes.clone().json();
        console.log("[mypage] detail response body", detailPreview);
      } catch (previewErr) {
        console.log("[mypage] detail response body parse error", previewErr);
      }

      if (basicRes.status === 401 || detailRes.status === 401) {
        clearAuthCookies();
        router.replace("/auth/signin");
        return;
      }

      if (!basicRes.ok) {
        throw new Error("기본 정보를 불러오지 못했습니다.");
      }
      if (!detailRes.ok) {
        throw new Error("상세 정보를 불러오지 못했습니다.");
      }

      const basic = (await basicRes.json()) as BasicResponse;
      const detail = (await detailRes.json()) as DetailResponse;
      const tagMap = detail.tags || {};
      const tagInterests = normalizeArray(tagMap["관심 분야"]);
      const tagMajor = normalizeArray(tagMap["전공"]);
      const tagEducation = normalizeArray(tagMap["최종 학력"]);
      const tagEmployment = normalizeArray(tagMap["취업 상태"]);
      const tagSpecial = normalizeArray(tagMap["특화 분야"]);
      const tagMarital = normalizeArray(tagMap["혼인 여부"]);

      setEmail(basic.email || "");
      setNickname(basic.nickname || "");
      setLocation(basic.location || "");
      const { y, m, d } = parseBirthDate(basic.birthDate);
      setBirthYear(y);
      setBirthMonth(m);
      setBirthDay(d);

      setMaritalStatus(tagMarital[0] || detail.maritalStatus || "");
      setEmploymentStatus(tagEmployment.length ? tagEmployment : detail.employmentStatus || []);
      setEducation(tagEducation[0] || detail.education || "");
      setMajor(tagMajor[0] || detail.major || "");
      setIncome(typeof detail.income === "number" ? detail.income : "");
      setSpecialGroup(tagSpecial.length ? tagSpecial : detail.specialGroup || []);
      setInterests(tagInterests.length ? tagInterests : detail.interests || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      clearAuthCookies();
      router.replace("/auth/signin");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleToggleEdit = async () => {
    if (readOnly) {
      setReadOnly(false);
      setInfoMessage("필요한 정보를 업데이트해주세요.");
      return;
    }

    try {
      setSaving(true);
      setInfoMessage(null);
      setError(null);

      const payload: Record<string, unknown> = {
        email,
        nickname,
        birthDate,
        location,
        maritalStatus,
        employmentStatus,
        education,
        major,
        income: income === "" ? undefined : income,
        specialGroup,
        interests,
      };
      if (password) {
        payload.password = password;
      }

      const res = await fetchWithAuth("/api/mypage/edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "수정에 실패했습니다.");
      }

      setReadOnly(true);
      setPassword("");
      setInfoMessage("개인정보가 업데이트되었습니다.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[#2f3642]">
        <span className="text-sm font-semibold">정보를 불러오는 중입니다...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#2f3642]">
      <div className="flex min-h-screen">
        <SideNav active="mypage" />
        <div className="flex flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
          <PageHeader readOnly={readOnly} onToggleEdit={handleToggleEdit} disabled={saving} />

          {error ? (
            <div className="rounded-lg border border-[#f4c7c7] bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#b42318]">
              {error}
            </div>
          ) : null}
          {infoMessage ? (
            <div className="rounded-lg border border-[#d7e4ff] bg-[#f5f8ff] px-4 py-3 text-sm font-semibold text-[#2f6bff]">
              {infoMessage}
            </div>
          ) : null}

          <AccountInfoCard
            email={email}
            password={password}
            readOnly={readOnly}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
          />

          <SectionCard title="기본정보">
            <BasicInfoSection
              birthYear={birthYear}
              birthMonth={birthMonth}
              birthDay={birthDay}
              location={location}
              nickname={nickname}
              readOnly={readOnly}
              onChangeBirth={(part, value) => {
                if (part === "year") setBirthYear(value);
                if (part === "month") setBirthMonth(value);
                if (part === "day") setBirthDay(value);
              }}
              onChangeLocation={setLocation}
              onChangeNickname={setNickname}
            />
          </SectionCard>

          <SectionCard title="개인정보">
            <PersonalInfoSection
              maritalStatus={maritalStatus}
              employmentStatus={employmentStatus}
              education={education}
              major={major}
              income={income}
              specialGroup={specialGroup}
              interests={interests}
              readOnly={readOnly}
              onChangeMarital={setMaritalStatus}
              onChangeEmployment={setEmploymentStatus}
              onChangeEducation={setEducation}
              onChangeMajor={setMajor}
              onChangeIncome={setIncome}
              onChangeSpecialGroup={setSpecialGroup}
              onChangeInterests={setInterests}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
