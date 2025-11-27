import PromptInput from "./PromptInput";
import RecommendationCard from "./RecommendationCard";
import type { PolicyCardData } from "./types";

interface ChatViewProps {
  promptLabel: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  recommendations: PolicyCardData[];
  onSelectPolicy: (policy: PolicyCardData) => void;
  statusMessage?: string | null;
}

export default function ChatView({
  promptLabel,
  inputValue,
  onInputChange,
  onSubmit,
  loading,
  recommendations,
  onSelectPolicy,
  statusMessage,
}: ChatViewProps) {
  return (
    <section className="flex flex-col gap-6 px-6 pb-10 pt-8">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between gap-4">
          <div className="rounded-full bg-[#e7eaee] px-4 py-2 text-sm text-[#606773]">
            {statusMessage || "다음은 맞춤 정책 추천 결과입니다."}
          </div>
          <div className="rounded-full bg-[#1f6bff] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_12px_rgba(0,98,255,0.35)]">
            {promptLabel || "주거 관련 정책 추천해줘"}
          </div>
        </div>

        <div className="space-y-3">
          {recommendations.map((policy) => (
            <RecommendationCard
              key={policy.id}
              policy={policy}
              onSelect={onSelectPolicy}
            />
          ))}
          {!recommendations.length ? (
            <div className="rounded-2xl border border-dashed border-[#d2d7de] bg-white px-5 py-6 text-center text-sm text-[#5c6472]">
              {statusMessage || "추천 결과가 없습니다."}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-4 pt-6">
        <PromptInput
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSubmit}
          loading={loading}
          buttonLabel="추천받기"
          placeholder="예) 전세자금 지원, 취업 청년 세금 혜택, 창업 지원금..."
        />
      </div>
    </section>
  );
}
