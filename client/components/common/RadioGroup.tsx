interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  readOnly?: boolean;
}

export default function RadioGroup({ name, value, onChange, options, readOnly }: RadioGroupProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-[#3b4350]">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label key={opt.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className="h-4 w-4 accent-[#2f6bff]"
            />
            <span className={readOnly ? "text-[#7a7f89]" : undefined}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
