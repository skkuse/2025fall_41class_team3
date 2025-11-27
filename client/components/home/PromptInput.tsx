import type { ReactNode } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  buttonLabel?: string;
  loading?: boolean;
  helperText?: string;
  trailingAddon?: ReactNode;
}

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "예) 전세자금 지원, 취업 청년 세금 혜택, 창업 지원금...",
  buttonLabel = "추천받기",
  loading = false,
  helperText,
  trailingAddon,
}: PromptInputProps) {
  return (
    <div className="w-full max-w-4xl">
      <div className="relative flex items-center gap-3 rounded-full border border-[#d7d7d7] bg-white px-6 py-3 shadow-[0_8px_16px_rgba(0,0,0,0.07)]">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="w-full border-none text-sm text-[#5f6674] outline-none placeholder:text-[#a0a5ad]"
        />
        {trailingAddon && (
          <div className="hidden items-center gap-2 md:flex">{trailingAddon}</div>
        )}
        <button
          type="button"
          disabled={!value.trim() || loading}
          onClick={onSubmit}
          className="flex min-w-[120px] items-center justify-center rounded-full bg-[#1f6bff] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_14px_rgba(0,98,255,0.3)] transition hover:bg-[#1a5ae0] disabled:cursor-not-allowed disabled:bg-[#9ab8ff]"
        >
          {loading ? "불러오는 중" : buttonLabel}
        </button>
      </div>
      {helperText && (
        <p className="mt-4 text-center text-sm text-[#6f7784]">{helperText}</p>
      )}
    </div>
  );
}
