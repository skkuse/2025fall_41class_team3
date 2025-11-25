import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  children: ReactNode;
}

export default function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-[#e2e5ea] bg-white/80 p-6 shadow-[0_10px_26px_rgba(0,0,0,0.04)]">
      <h2 className="text-lg font-bold text-[#2f3642]">{title}</h2>
      <div className="mt-5 space-y-5 text-sm text-[#3b4350]">{children}</div>
    </section>
  );
}
