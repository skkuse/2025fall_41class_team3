import type { ReactNode, SelectHTMLAttributes } from "react";

interface SelectInputProps {
  selectProps?: SelectHTMLAttributes<HTMLSelectElement>;
  readOnly?: boolean;
  children?: ReactNode;
}

export default function SelectInput({ selectProps, readOnly, children }: SelectInputProps) {
  return (
    <select
      className={`h-10 min-w-[88px] rounded-md border px-2 text-sm outline-none transition ${
        readOnly
          ? "cursor-not-allowed border-[#e2e5ea] bg-[#f7f8fa] text-[#7a7f89]"
          : "border-[#cfd5df] bg-white text-[#2f3642] focus:border-[#2f6bff] focus:shadow-[0_8px_18px_rgba(47,107,255,0.18)]"
      }`}
      disabled={readOnly}
      {...selectProps}
    >
      {children}
    </select>
  );
}
