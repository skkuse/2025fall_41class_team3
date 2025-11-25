import type { InputHTMLAttributes } from "react";

interface TextInputProps {
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  readOnly?: boolean;
}

export default function TextInput({ inputProps, readOnly }: TextInputProps) {
  return (
    <input
      className={`h-10 w-full rounded-md border px-3 text-sm outline-none transition ${
        readOnly
          ? "cursor-not-allowed border-[#e2e5ea] bg-[#f7f8fa] text-[#7a7f89]"
          : "border-[#cfd5df] bg-white text-[#2f3642] focus:border-[#2f6bff] focus:shadow-[0_8px_18px_rgba(47,107,255,0.18)]"
      }`}
      readOnly={readOnly}
      disabled={readOnly}
      {...inputProps}
    />
  );
}
