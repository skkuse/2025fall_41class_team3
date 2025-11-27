import FieldRow from "@/components/common/FieldRow";
import SelectInput from "@/components/common/SelectInput";
import TextInput from "@/components/common/TextInput";

interface BasicInfoSectionProps {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  location: string;
  nickname: string;
  readOnly: boolean;
  onChangeBirth: (part: "year" | "month" | "day", value: string) => void;
  onChangeLocation: (value: string) => void;
  onChangeNickname: (value: string) => void;
}

const years = Array.from({ length: 70 }).map((_, idx) => `${1955 + idx}`);
const months = Array.from({ length: 12 }).map((_, idx) => `${idx + 1}`.padStart(2, "0"));
const days = Array.from({ length: 31 }).map((_, idx) => `${idx + 1}`.padStart(2, "0"));

export default function BasicInfoSection({
  birthYear,
  birthMonth,
  birthDay,
  location,
  nickname,
  readOnly,
  onChangeBirth,
  onChangeLocation,
  onChangeNickname,
}: BasicInfoSectionProps) {
  return (
    <div className="grid gap-5 text-sm text-[#3b4350] sm:grid-cols-2">
      <FieldRow label="생년월일">
        <div className="flex flex-wrap items-center gap-2">
          <SelectInput
            readOnly={readOnly}
            selectProps={{
              value: birthYear,
              onChange: (e) => onChangeBirth("year", e.target.value),
            }}
          >
            <option value="">년도</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectInput>
          <span className="text-xs text-[#8a8f99]">년</span>
          <SelectInput
            readOnly={readOnly}
            selectProps={{
              value: birthMonth,
              onChange: (e) => onChangeBirth("month", e.target.value),
            }}
          >
            <option value="">월</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
          <span className="text-xs text-[#8a8f99]">월</span>
          <SelectInput
            readOnly={readOnly}
            selectProps={{
              value: birthDay,
              onChange: (e) => onChangeBirth("day", e.target.value),
            }}
          >
            <option value="">일</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectInput>
          <span className="text-xs text-[#8a8f99]">일</span>
        </div>
      </FieldRow>

      <FieldRow label="거주 지역">
        <TextInput
          readOnly={readOnly}
          inputProps={{
            value: location,
            onChange: (e) => onChangeLocation(e.target.value),
            placeholder: "거주 지역을 입력하세요",
          }}
        />
      </FieldRow>

      <FieldRow label="닉네임">
        <TextInput
          readOnly={readOnly}
          inputProps={{
            value: nickname,
            onChange: (e) => onChangeNickname(e.target.value),
            placeholder: "닉네임을 입력하세요",
          }}
        />
      </FieldRow>
    </div>
  );
}
