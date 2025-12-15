import { X } from "lucide-react";
import type { PolicyDetail } from "./types"; // 아까 수정한 그 인터페이스(plcyNm 있는 것)

interface PolicyDetailModalProps {
  policy: PolicyDetail | null;
  onClose: () => void;
}

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
          <p className="leading-relaxed whitespace-pre-wrap text-sm text-gray-800">
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

  const descriptionRows = [
  { label: "정책 설명", value: policy.plcyExplnCn },
  { label: "지원내용", value: policy.plcySprtCn },
  ].filter(r => r.value);

  const periodRows = [
  { label: "신청 기간", value: policy.aplyYmd },
  {
    label: "사업 기간",
    value:
      policy.bizPrdBgngYmd && policy.bizPrdEndYmd
        ? `${policy.bizPrdBgngYmd} ~ ${policy.bizPrdEndYmd}`
        : policy.bizPrdBgngYmd,
  },
  ].filter(r => r.value);

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
  const handleApplyClick = () => {
  const aply = typeof policy.aplyUrlAddr === "string" ? policy.aplyUrlAddr.trim() : "";
  if (aply) {
    // 신청 사이트는 alert 없이 바로 이동
    window.open(aply, "_blank", "noopener,noreferrer");
    return;
  }

  const ref1 = typeof policy.refUrlAddr1 === "string" ? policy.refUrlAddr1.trim() : "";
  if (ref1) {
    alert("참고페이지 1로 이동합니다.");
    window.open(ref1, "_blank", "noopener,noreferrer");
    return;
  }

  const ref2 = typeof policy.refUrlAddr2 === "string" ? policy.refUrlAddr2.trim() : "";
  if (ref2) {
    alert("참고페이지 2로 이동합니다.");
    window.open(ref2, "_blank", "noopener,noreferrer");
    return;
  }

  alert("신청/참고 URL 정보가 없습니다. 구글에서 검색할게요.");

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(policy.plcyNm)}`;
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