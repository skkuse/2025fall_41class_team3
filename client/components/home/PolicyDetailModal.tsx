import { X } from "lucide-react";
import type { PolicyDetail } from "./types"; // 아까 수정한 그 인터페이스(plcyNm 있는 것)

interface PolicyDetailModalProps {
  policy: PolicyDetail | null;
  onClose: () => void;
}

export default function PolicyDetailModal({
  policy,
  onClose,
}: PolicyDetailModalProps) {
  if (!policy) return null;

  // 1. 서버 데이터 키값으로 매핑 (값이 있는 것만 필터링)
  const rows = [
    { label: "정책 설명", value: policy.plcyExplnCn },
    { label: "지원내용", value: policy.plcySprtCn },
    { label: "신청 방법", value: policy.plcyAplyMthdCn },
    { label: "신청 기간", value: policy.aplyYmd },
    { 
      label: "사업 기간", 
      value: (policy.bizPrdBgngYmd && policy.bizPrdEndYmd) 
        ? `${policy.bizPrdBgngYmd} ~ ${policy.bizPrdEndYmd}` 
        : "" 
    },
    { label: "제출 서류", value: policy.sbmsnDcmntCn }, // 추가됨
    { label: "심사 방법", value: policy.srngMthdCn },   // 추가됨
  ].filter((item) => item.value);

  // 2. 신청 페이지 이동 핸들러
  const handleApplyClick = () => {
    if (policy.aplyUrlAddr) {
      window.open(policy.aplyUrlAddr, "_blank", "noopener,noreferrer");
    } else {
      alert("신청 페이지 URL 정보가 없습니다.");
    }
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
        <div className="space-y-5 px-7 py-6 text-[#505866] overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-dashed border-[#cfd3da] bg-[#f9fafb] px-5 py-4"
            >
              <p className="text-sm font-semibold text-[#576072] mb-2">
                {row.label}
              </p>
              {/* ★ 중요: 줄바꿈 처리를 위해 whitespace-pre-wrap 추가 */}
              <p className="leading-relaxed whitespace-pre-wrap text-sm text-gray-800">
                {row.value}
              </p>
            </div>
          ))}
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