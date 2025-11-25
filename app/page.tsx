"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatView from "@/components/home/ChatView";
import FooterSection from "@/components/home/FooterSection";
import InitialView from "@/components/home/InitialView";
import PolicyDetailModal from "@/components/home/PolicyDetailModal";
import SideNav from "@/components/home/SideNav";
import TopNotice from "@/components/home/TopNotice";
import { fetchWithAuth } from "@/lib/auth/apiClient";
import { clearAuthCookies, getAccessToken } from "@/lib/auth/tokenClient";
import type { PolicyCardData, PolicyDetail } from "@/components/home/types";

type ViewMode = "initial" | "chat";

export default function HomePage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("initial");
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("주거 관련 정책 추천해줘");
  const [recommendations, setRecommendations] = useState<PolicyCardData[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommendationIds, setRecommendationIds] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      clearAuthCookies();
      router.replace("/auth/signin");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const mapRecommendError = (status: number) => {
    if (status === 400) return "오늘 추천 횟수가 모두 소진되었습니다.";
    if (status === 401) return "인증에 실패했습니다. 다시 로그인해주세요.";
    if (status === 404) return "사용자 정보를 찾을 수 없습니다.";
    if (status === 500) return "서버 오류가 발생했습니다.";
    return null;
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      console.log("[recommend] submit start", prompt.trim());
      const res = await fetchWithAuth(
        `/api/policies/recommend?prompt=${encodeURIComponent(prompt.trim())}`,
      );
      console.log("[recommend] recommend response", res.status);

      if (res.ok) {
        const data = (await res.json()) as {
          recommendations?: {
            id: number;
            plcyNm?: string;
            reason?: string;
            badges?: string[];
            summary?: string;
            title?: string;
            tags?: string[];
          }[];
        };

        const recs: PolicyCardData[] = (data.recommendations || []).map((r) => ({
          id: r.id,
          title: r.plcyNm || r.title || "정책 제목",
          summary: r.reason || r.summary || "추천 사유를 불러올 수 없습니다.",
          tags: r.badges || r.tags,
        }));

        const finalRecs = recs;
        setRecommendations(finalRecs);
        setRecommendationIds(finalRecs.map((r) => r.id));
        setStatusMessage(null);
        console.log("[recommend] final recommendations", finalRecs.map((r) => r.id));
      } else {
        const errorText = await res.text();
        console.log("[recommend] recommend failed response body", errorText);
        const message = mapRecommendError(res.status) || errorText || "추천 요청에 실패했습니다.";
        setRecommendations([]);
        setRecommendationIds([]);
        setStatusMessage(message);
        console.log("[recommend] recommend failed, status message set");
      }
    } catch (err) {
      console.error(err);
      setRecommendations([]);
      setRecommendationIds([]);
      setStatusMessage("추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
      console.log("[recommend] exception, cleared recommendations");
    } finally {
      setLastPrompt(prompt.trim());
      setView("chat");
      setLoading(false);
    }
  };

  const handlePolicySelect = async (policy: PolicyCardData) => {
    try {
      // Only allow selecting policies that came from last recommendation set
      if (!recommendationIds.includes(policy.id)) {
        throw new Error("추천 목록에 없는 정책입니다.");
      }

      const res = await fetchWithAuth(`/api/policies/${policy.id}`);
      if (!res.ok) {
        throw new Error("정책 상세 조회 실패");
      }
      const data = (await res.json()) as Partial<PolicyDetail>;
      const detail: PolicyDetail = {
        ...policy,
        ...data,
        id: policy.id,
        title: data.title || policy.title,
        summary: data.summary || data.description || policy.summary,
      };
      setSelectedPolicy(detail);
      setStatusMessage(null);
    } catch (err) {
      console.error(err);
      setSelectedPolicy(null);
      setStatusMessage("정책 상세 조회에 실패했습니다.");
    } finally {
      //
    }
  };

  if (!authChecked) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#4d5564]">
      <div className="flex min-h-screen">
        <SideNav active="home" />
        <div className="flex flex-1 flex-col">
          <TopNotice />

          {view === "initial" ? (
            <InitialView
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              loading={loading}
            />
          ) : (
          <ChatView
            promptLabel={lastPrompt}
            inputValue={prompt}
            onInputChange={setPrompt}
            onSubmit={handleSubmit}
            loading={loading}
            recommendations={recommendations}
            onSelectPolicy={handlePolicySelect}
            statusMessage={statusMessage}
          />
        )}

          <FooterSection />
        </div>
      </div>

      <PolicyDetailModal policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </div>
  );
}
