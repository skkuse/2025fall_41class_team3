import { ChevronRight } from "lucide-react";
import type { PolicyCardData } from "./types";

interface RecommendationCardProps {
  policy: PolicyCardData;
  onSelect: (policy: PolicyCardData) => void;
}

export default function RecommendationCard({
  policy,
  onSelect,
}: RecommendationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(policy)}
      className="w-full rounded-2xl border border-[#dfe2e6] bg-white px-5 py-4 text-left shadow-[0_10px_20px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[17px] font-semibold text-[#4c5463]">
            {policy.title}
          </p>
          <p className="text-sm leading-relaxed text-[#6c7482]">
            {policy.summary}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-[#c2c7ce]" />
      </div>
      {policy.tags && policy.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {policy.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#d5d9df] bg-[#f4f6f9] px-3 py-1 text-xs font-semibold text-[#5e6675]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
