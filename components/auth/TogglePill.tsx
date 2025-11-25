interface TogglePillProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function TogglePill({ label, active, onClick }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-[#2f6bff] bg-[#e8f0ff] text-[#2f6bff] shadow-[0_6px_14px_rgba(47,107,255,0.16)]"
          : "border-[#d8dbe1] bg-white text-[#4a5260] hover:border-[#2f6bff] hover:text-[#2f6bff]"
      }`}
    >
      {label}
    </button>
  );
}
