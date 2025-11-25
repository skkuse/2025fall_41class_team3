import type { ReactNode } from "react";

interface FieldRowProps {
  label: string;
  children: ReactNode;
  required?: boolean;
}

export default function FieldRow({ label, children, required }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 text-xs font-semibold text-[#5b6371]">
        <span>{label}</span>
        {required ? <span className="text-[#2f6bff]">*</span> : null}
      </div>
      {children}
    </div>
  );
}
