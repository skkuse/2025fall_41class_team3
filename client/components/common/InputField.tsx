import type { InputHTMLAttributes, ReactNode } from "react";

interface InputFieldProps {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  helper?: ReactNode;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export default function InputField({
  label,
  actionLabel,
  onAction,
  helper,
  inputProps,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[#4a5260]">
        <span>{label}</span>
        {helper}
      </div>
      <div className="flex items-center gap-3">
        <input
          className="h-11 w-full rounded-md border border-[#d8dbe1] bg-white px-3 text-sm text-[#303744] outline-none transition focus:border-[#2f6bff] focus:shadow-[0_6px_14px_rgba(47,107,255,0.18)]"
          {...inputProps}
        />
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 rounded-md border border-[#2f6bff] px-3 py-2 text-xs font-semibold text-[#2f6bff] transition hover:bg-[#2f6bff] hover:text-white"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
