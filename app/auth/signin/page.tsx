"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/auth/InputField";
import { setAuthCookies } from "@/lib/auth/tokenClient";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error("이메일 또는 비밀번호를 확인해주세요.");
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

      // TODO: 토큰 저장 및 온보딩 여부 확인 후 라우팅
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("이메일 또는 비밀번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="로그인"
      description="아이디로 사용할 이메일과 비밀번호를 입력해 주세요."
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl flex-col gap-7"
      >
        <div className="space-y-5 rounded-2xl bg-white/70 px-8 py-10 shadow-[0_12px_30px_rgba(0,0,0,0.06)]">
          <InputField
            label="이메일"
            inputProps={{
              type: "email",
              placeholder: "이메일을 입력해 주세요.",
              value: email,
              onChange: (e) => setEmail(e.target.value),
            }}
          />

          <InputField
            label="비밀번호"
            inputProps={{
              type: "password",
              placeholder: "비밀번호를 입력해 주세요.",
              value: password,
              onChange: (e) => setPassword(e.target.value),
            }}
          />

          {error ? (
            <p className="text-sm font-semibold text-[#d64545]">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            className="h-12 rounded-md bg-[#2363f3] text-base font-bold text-white shadow-[0_10px_20px_rgba(35,99,243,0.28)] transition hover:bg-[#1c55d8] disabled:cursor-not-allowed disabled:bg-[#9bb8ff]"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <button
            type="button"
            className="h-12 rounded-md border border-[#2761df] text-base font-bold text-[#2761df] transition hover:bg-[#eef3ff]"
            onClick={() => router.push("/auth/signup")}
          >
            회원가입
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
