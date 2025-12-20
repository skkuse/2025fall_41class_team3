"use client";

import { useEffect, useState } from "react";
import SideNav from "@/components/home/SideNav";
import TopNotice from "@/components/home/TopNotice";
import FooterSection from "@/components/home/FooterSection";
import PromptInput from "@/components/home/PromptInput";
import CheckboxPills from "@/components/common/CheckboxPills";
import RecommendationCard from "@/components/home/RecommendationCard";
import PolicyDetailModal from "@/components/home/PolicyDetailModal";
import { fetchWithAuth } from "@/lib/auth/apiClient";
import type { PolicyCardData, PolicyDetail } from "@/components/home/types";

export default function DiscoverPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<PolicyCardData[]>([]);
  const [popular, setPopular] = useState<PolicyCardData[]>([]);
  const [recent, setRecent] = useState<PolicyCardData[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filters: match Mypage fields
  const [income, setIncome] = useState<number | "">("");
  const [selectedSpecialGroups, setSelectedSpecialGroups] = useState<string[]>([]);

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


  useEffect(() => {
    // Fetch popular and recent on mount
    const fetchLists = async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          fetchWithAuth("/api/policies/popular"),
          fetchWithAuth("/api/policies/recent"),
        ]);

        if (pRes.ok) {
          const pData = (await pRes.json()) as { id: number; plcyNm: string }[];
          setPopular(
            pData.map((p) => ({ id: p.id, title: p.plcyNm, summary: "", tags: [] }))
          );
        }

        if (rRes.ok) {
          const rData = (await rRes.json()) as { id: number; plcyNm: string }[];
          setRecent(
            rData.map((p) => ({ id: p.id, title: p.plcyNm, summary: "", tags: [] }))
          );
        }
      } catch (err) {
        console.error("[discover] failed to load lists", err);
      }
    };

    fetchLists();
  }, []);

  const handleSearch = async () => {
    // Search the DB (server-side search_v2) and narrow client-side by income if provided
    setLoading(true);
    setStatusMessage(null);

    try {
      const params = new URLSearchParams();
      if (prompt.trim()) params.set("q", prompt.trim());
      if (selectedSpecialGroups.length) params.set("specialGroup", selectedSpecialGroups.join(","));

      const res = await fetchWithAuth(`/api/policies/search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        setStatusMessage(text || "검색에 실패했습니다.");
        setRecommendations([]);
        return;
      }

      const list = (await res.json()) as { id: number; plcyNm: string }[];

      // Fetch details for top results (limit to 30 to avoid heavy requests)
      const ids = list.slice(0, 30).map((r) => r.id);
      const detailPromises = ids.map((id) => fetchWithAuth(`/api/policies/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
      const details = (await Promise.all(detailPromises)) as (Partial<PolicyDetail> | null)[];

      // Apply income filter if provided
      const filtered = details
        .map((d) => d)
        .filter(Boolean) as PolicyDetail[];

      const final = filtered.filter((p) => {
        if (income === "") return true;
        const inc = Number(income);
        const min = Number((p as any).earnMinAmt || 0);
        const max = Number((p as any).earnMaxAmt || 0);
        if (min === 0 && max === 0) return true; // treat as unrestricted
        return inc >= min && inc <= max;
      });

      const recs: PolicyCardData[] = final.map((p) => ({
        id: p.id,
        title: p.plcyNm || "정책 제목",
        summary: p.plcySprtCn || "",
        tags: p.plcyKywdNm || [],
      }));

      setRecommendations(recs);
    } catch (err) {
      console.error(err);
      setStatusMessage("검색에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (policy: PolicyCardData) => {
    try {
      const res = await fetchWithAuth(`/api/policies/${policy.id}`);
      if (!res.ok) throw new Error("detail fetch failed");
      const data = (await res.json()) as Partial<PolicyDetail>;
      const detail: PolicyDetail = { ...policy, ...data, id: policy.id } as PolicyDetail;
      setSelectedPolicy(detail);
    } catch (err) {
      console.error(err);
      setStatusMessage("정책 상세 조회에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#4d5564]">
      <div className="flex min-h-screen">
        <SideNav active="discover" />
        <div className="flex flex-1 flex-col">
          <TopNotice />

          <main className="px-8 py-10">
            <h2 className="text-2xl font-bold text-[#1f2b3a] mb-6">Discover</h2>

            <section className="mb-8">
              <h3 className="mb-4 text-lg font-semibold">맞춤 추천</h3>

              {/* 필터: 소득 + 특화 그룹 (mypage와 동일) */}
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm text-[#6f7784]">소득 (원)</p>
                  <input
                    type="number"
                    value={income === "" ? "" : income}
                    onChange={(e) => setIncome(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-11 w-full rounded-md border px-3 text-sm"
                    placeholder="예) 3000000"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm text-[#6f7784]">특화 분야</p>
                  <CheckboxPills
                    options={SPECIAL_GROUP_OPTIONS.map((v) => ({ label: v, value: v }))}
                    values={selectedSpecialGroups}
                    onChange={setSelectedSpecialGroups}
                  />
                </div>
              </div>

              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleSearch}
                loading={loading}
                helperText={statusMessage || undefined}
                buttonLabel="검색"
              />

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((r) => (
                  <RecommendationCard key={r.id} policy={r} onSelect={handleSelect} />
                ))}
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-lg font-semibold">인기 정책</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {popular.map((p) => (
                  <RecommendationCard key={p.id} policy={p} onSelect={handleSelect} />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-lg font-semibold">최근 등록</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recent.map((p) => (
                  <RecommendationCard key={p.id} policy={p} onSelect={handleSelect} />
                ))}
              </div>
            </section>
          </main>

          <FooterSection />
        </div>
      </div>

      <PolicyDetailModal policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </div>
  );
}
