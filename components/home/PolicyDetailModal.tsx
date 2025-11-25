import { X } from "lucide-react";
import type { PolicyDetail } from "./types";

interface PolicyDetailModalProps {
  policy: PolicyDetail | null;
  onClose: () => void;
}

export default function PolicyDetailModal({
  policy,
  onClose,
}: PolicyDetailModalProps) {
  if (!policy) return null;

  const rows = [
    { label: "정책 설명", value: policy.description },
    { label: "지원내용", value: policy.support },
    { label: "신청 방법", value: policy.applyMethod },
    { label: "신청 기간", value: policy.applyPeriod },
    { label: "사업 기간", value: policy.projectPeriod },
  ].filter((item) => item.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <header className="flex items-start justify-between bg-[#e8e9ec] px-7 py-6 text-[#4c5463]">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-[#6b7381]">
              <span className="rounded-full border border-[#c8ccd4] px-3 py-1">
                {policy.category || "일자리>창업"}
              </span>
              <span className="text-base">
                {"★".repeat(policy.rating || 5)}
              </span>
            </div>
            <h3 className="text-2xl font-bold leading-tight">
              {policy.title}
            </h3>
            {policy.badge && (
              <span className="inline-flex rounded-full border border-[#b8bdc6] px-3 py-1 text-sm font-semibold text-[#5c6573]">
                {policy.badge}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="모달 닫기"
            className="rounded-full p-2 text-[#7b8290] transition hover:bg-white"
            onClick={onClose}
          >
            <X className="h-7 w-7" />
          </button>
        </header>

        <div className="space-y-5 px-7 py-6 text-[#505866]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-dashed border-[#cfd3da] bg-[#f9fafb] px-5 py-4"
            >
              <p className="text-sm font-semibold text-[#576072]">
                {row.label}
              </p>
              <p className="mt-2 leading-relaxed">{row.value}</p>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-[#1f6bff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_18px_rgba(0,98,255,0.35)] transition hover:bg-[#1a5ae0]"
              onClick={onClose}
            >
              신청 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
