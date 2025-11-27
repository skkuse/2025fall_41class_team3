interface PageHeaderProps {
  readOnly: boolean;
  onToggleEdit: () => void;
  disabled?: boolean;
}

export default function PageHeader({ readOnly, onToggleEdit, disabled }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-xl font-bold text-[#2f3642]">계정정보</h1>
      <button
        type="button"
        onClick={onToggleEdit}
        disabled={disabled}
        className={`rounded-full px-6 py-2 text-sm font-semibold shadow-[0_10px_22px_rgba(38,100,247,0.28)] transition ${
          readOnly
            ? "bg-white text-[#2761df] ring-1 ring-[#2761df] hover:bg-[#eef3ff]"
            : "bg-[#2761df] text-white hover:bg-[#1f52bf]"
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {readOnly ? "개인정보 수정" : "개인정보 수정 완료"}
      </button>
    </div>
  );
}
