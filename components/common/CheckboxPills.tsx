interface CheckboxPillsProps {
  options: { label: string; value: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  readOnly?: boolean;
}

export default function CheckboxPills({ options, values, onChange, readOnly }: CheckboxPillsProps) {
  const toggle = (val: string) => {
    if (readOnly) return;
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => {
        const active = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`min-w-[68px] rounded-full border px-3 py-1 text-xs font-semibold transition ${
              active
                ? "border-[#2f6bff] bg-[#eef3ff] text-[#2f6bff]"
                : "border-[#d6dce5] bg-white text-[#5b6371] hover:border-[#2f6bff] hover:text-[#2f6bff]"
            } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
