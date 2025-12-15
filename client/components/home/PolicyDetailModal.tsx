import { X } from "lucide-react";
import type { PolicyDetail } from "./types"; // 아까 수정한 그 인터페이스(plcyNm 있는 것)
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/apiClient";

interface PolicyDetailModalProps {
  policy: PolicyDetail | null;
  onClose: () => void;
}


const formatDateSmart = (raw?: string): string => {
  if (!raw) return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed.includes("~")) {
    const [start, end] = trimmed.split("~").map(s => s.trim());
    const s = formatDateSmart(start);
    const e = formatDateSmart(end);
    if (s && e) return `${s} ~ ${e}`;
    return trimmed;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const d = trimmed.slice(6, 8);
    return `${y}년 ${m}월 ${d}일`;
  }

  return trimmed;
};


function Section({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value?: string }[];
}) {
  if (!rows.length) return null;

  return (
    <section className="space-y-3">
      <h4 className="text-lg font-bold text-gray-900">{title}</h4>
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl border border-dashed border-[#cfd3da] bg-[#f9fafb] px-5 py-4"
        >
          <p className="text-sm font-semibold text-[#576072] mb-2">
            {row.label}
          </p>

          <p
            className={`leading-relaxed whitespace-pre-wrap text-sm ${
              row.value === "요약중입니다…"
                ? "text-gray-400 animate-pulse"
                : "text-gray-800"
            }`}
          >
            {row.value}
          </p>
        </div>
      ))}
    </section>
  );
}



export default function PolicyDetailModal({
  policy,
  onClose,
}: PolicyDetailModalProps) {
  if (!policy) return null;

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    if (!policy?.id) return;

    setSummary(null);
    setSummaryError(false);
    setSummaryLoading(true);

    fetchWithAuth(`/api/policies/${policy.id}/summary`)
    .then((res) => {
      if (!res.ok) throw new Error("summary fetch failed");
      return res.json();
    })
    .then((data) => {
      setSummary(data.summary);
    })
    .catch(() => {
      setSummaryError(true);
    })
    .finally(() => {
      setSummaryLoading(false);
    });
  }, [policy.id]);


  const descriptionRows = [
  { label: "정책 설명", value: policy.plcyExplnCn },
  { label: "지원내용", value: policy.plcySprtCn },
  ].filter(r => r.value);

  const summaryRows = [
    {
      label: "AI 요약",
      value: summaryLoading
        ? "요약중입니다…"
        : summaryError
        ? "요약을 불러오지 못했습니다."
        : summary || "",
    },
  ];


 const periodRows = [
  {
    label: "신청 기간",
    value: formatDateSmart(policy.aplyYmd) || "상시",
  },
  {
    label: "사업 기간",
    value: (() => {
      const start = formatDateSmart(policy.bizPrdBgngYmd);
      const end = formatDateSmart(policy.bizPrdEndYmd);

      if (start && end) return `${start} ~ ${end}`;
      if (start) return `${start}부터`;
      return "상시";
    })(),
  },
];


  const applyRows = [
  { label: "신청 방법", value: policy.plcyAplyMthdCn },
  { label: "심사 방법", value: policy.srngMthdCn },
  { label: "제출 서류", value: policy.sbmsnDcmntCn },
  ].filter(r => r.value);

  const eligibilityRows = [
    {
      label: "연령",
      value:
        policy.sprtTrgtAgeLmtYn === "N"
          ? "제한없음"
          : [policy.sprtTrgtMinAge, policy.sprtTrgtMaxAge]
              .filter(Boolean)
              .join(" ~ "),
    },
    { label: "거주지역", value: policy.zipCd || "전국" },
    { label: "소득", value: policy.earnEtcCn || "무관" },
    { label: "학력", value: policy.schoolCd || "제한없음" },
    { label: "전공", value: policy.plcyMajorCd || "제한없음" },
    { label: "취업상태", value: policy.jobCd || "제한없음" },
    { label: "특화분야", value: policy.sbizCd || "제한없음" },
    { label: "추가사항", value: policy.addAplyQlfcCndCn },
    { label: "참여제한 대상", value: policy.ptcpPrpTrgtCn },
  ].filter(r => r.value);

  const etcRows = [
  { label: "기타 정보", value: policy.etcMttrCn },
  { label: "참고사이트 1", value: policy.refUrlAddr1 },
  { label: "참고사이트 2", value: policy.refUrlAddr2 },
].filter(r => r.value);


  // 2. 신청 페이지 이동 핸들러
  const normalizeUrl = (url?: string) => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 이미 http/https 있으면 그대로
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 없으면 https 붙여줌
  return `https://${trimmed}`;
};

const handleApplyClick = () => {
  const applyUrl = normalizeUrl(policy.aplyUrlAddr);
  const ref1 = normalizeUrl(policy.refUrlAddr1);
  const ref2 = normalizeUrl(policy.refUrlAddr2);

  // 1) 신청 URL이 있으면 바로 이동 (알림 없음)
  if (applyUrl) {
    window.open(applyUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 2) 신청 URL이 없고 참고 URL이 있으면 알림 후 이동
  const refUrl = ref1 || ref2;
  if (refUrl) {
    alert("신청 페이지 URL이 없어 참고 페이지로 이동합니다.");
    window.open(refUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 3) 둘 다 없으면 구글 검색
  alert("신청/참고 URL 정보가 없습니다. 구글에서 검색할게요.");

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
    policy.plcyNm
  )}`;
  window.open(googleUrl, "_blank", "noopener,noreferrer");
};


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      {/* 백그라운드 클릭 시 모달 닫기 (옵션) */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] z-10 max-h-[90vh] flex flex-col">
        {/* 헤더 부분 */}
        <header className="flex items-start justify-between bg-[#e8e9ec] px-7 py-6 text-[#4c5463] shrink-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-[#6b7381]">
              <span className="rounded-full border border-[#c8ccd4] px-3 py-1 bg-white">
                {/* 대분류 > 중분류 조합 */}
                {policy.lclsfNm} &gt; {policy.mclsfNm}
              </span>
              {/* 별점은 현재 API에서 안 넘어오므로 일단 주석 처리하거나 0으로 둠 */}
              {/* <span className="text-base text-yellow-500">{"★".repeat(5)}</span> */}
            </div>
            
            <h3 className="text-2xl font-bold leading-tight text-black">
              {policy.plcyNm} {/* title 대신 plcyNm */}
            </h3>

            {/* 태그(키워드) 배열 처리 */}
            {policy.plcyKywdNm && policy.plcyKywdNm.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {policy.plcyKywdNm.map((keyword, index) => (
                  <span key={index} className="inline-flex rounded-full border border-[#b8bdc6] px-3 py-1 text-sm font-semibold text-[#5c6573] bg-white">
                    #{keyword}
                  </span>
                ))}
              </div>
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

        {/* 본문 (스크롤 가능하게 처리) */}
        <div className="space-y-8 px-7 py-6 overflow-y-auto">
          <Section title="한눈에 보는 정책 요약" rows={summaryRows} />
          <Section title="정책 개요" rows={descriptionRows} />
          <Section title="기간 정보" rows={periodRows} />
          <Section title="신청방법" rows={applyRows} />
          <Section title="신청자격" rows={eligibilityRows} />
          <Section title="기타" rows={etcRows} />
        </div>

        {/* 푸터 (버튼 영역) */}
        <div className="p-6 border-t border-gray-100 bg-white shrink-0 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-100 transition"
            >
              닫기
            </button>
            <button
              type="button"
              className="rounded-full bg-[#1f6bff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_18px_rgba(0,98,255,0.35)] transition hover:bg-[#1a5ae0]"
              onClick={handleApplyClick}
            >
              신청 페이지로 이동
            </button>
        </div>
      </div>
    </div>
  );
}