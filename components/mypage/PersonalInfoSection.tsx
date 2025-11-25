import CheckboxPills from "@/components/common/CheckboxPills";
import FieldRow from "@/components/common/FieldRow";
import RadioGroup from "@/components/common/RadioGroup";
import SelectInput from "@/components/common/SelectInput";
import TextInput from "@/components/common/TextInput";

interface PersonalInfoSectionProps {
  maritalStatus?: string;
  employmentStatus: string[];
  education?: string;
  major?: string;
  income?: number | "";
  specialGroup: string[];
  interests: string[];
  readOnly: boolean;
  onChangeMarital: (value: string) => void;
  onChangeEmployment: (values: string[]) => void;
  onChangeEducation: (value: string) => void;
  onChangeMajor: (value: string) => void;
  onChangeIncome: (value: number | "") => void;
  onChangeSpecialGroup: (values: string[]) => void;
  onChangeInterests: (values: string[]) => void;
}

const EMPLOYMENT_OPTIONS = [
  "재직자",
  "자영업자",
  "미취업자",
  "프리랜서",
  "일용근로자",
  "(예비)창업자",
  "단기근로자",
  "영농종사자",
  "기타",
];

const SPECIAL_GROUP_OPTIONS = [
  "중소기업",
  "여성",
  "기초생활수급자",
  "한부모가정",
  "장애인",
  "농업인",
  "군인",
  "지역인재",
  "기타",
];

const INTEREST_OPTIONS = [
  "대출",
  "보조금",
  "바우처",
  "금리혜택",
  "교육지원",
  "맞춤형상담서비스",
  "인턴",
  "벤처",
  "중소기업",
  "청년가장",
  "장기미취업청년",
  "공공임대주택",
  "신용회복",
  "육아",
  "출산",
  "해외진출",
  "주거지원",
];

const EDUCATION_OPTIONS = [
  "고졸 미만",
  "고교 재학",
  "고교 졸업",
  "대학 재학",
  "대졸 예정",
  "대학 졸업",
  "대학 석/박사",
];

const MAJOR_OPTIONS = [
  "인문계열",
  "사회계열",
  "상경계열",
  "이학계열",
  "공학계열",
  "예체능계열",
  "농산업계열",
  "기타",
];

export default function PersonalInfoSection({
  maritalStatus,
  employmentStatus,
  education,
  major,
  income,
  specialGroup,
  interests,
  readOnly,
  onChangeMarital,
  onChangeEmployment,
  onChangeEducation,
  onChangeMajor,
  onChangeIncome,
  onChangeSpecialGroup,
  onChangeInterests,
}: PersonalInfoSectionProps) {
  return (
    <div className="space-y-5 text-sm text-[#3b4350]">
      <FieldRow label="혼인 여부">
        <RadioGroup
          name="marital"
          value={maritalStatus}
          onChange={onChangeMarital}
          readOnly={readOnly}
          options={[
            { label: "기혼", value: "기혼" },
            { label: "미혼", value: "미혼" },
          ]}
        />
      </FieldRow>

      <FieldRow label="취업 상태">
        <SelectInput
          readOnly={readOnly}
          selectProps={{
            value: employmentStatus[0] || "",
            onChange: (e) => {
              const v = e.target.value;
              onChangeEmployment(v ? [v] : []);
            },
          }}
        >
          <option value="">선택</option>
          {EMPLOYMENT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectInput>
      </FieldRow>

      <div className="grid gap-4 sm:grid-cols-[1fr,1fr]">
        <FieldRow label="학력 수준">
          <SelectInput
            readOnly={readOnly}
            selectProps={{
              value: education || "",
              onChange: (e) => onChangeEducation(e.target.value),
            }}
          >
            <option value="">선택</option>
            {EDUCATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </SelectInput>
        </FieldRow>

        <FieldRow label="전공 계열">
          <SelectInput
            readOnly={readOnly}
            selectProps={{
              value: major || "",
              onChange: (e) => onChangeMajor(e.target.value),
            }}
          >
            <option value="">선택</option>
            {MAJOR_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
      </div>

      <FieldRow label="소득">
        <TextInput
          readOnly={readOnly}
          inputProps={{
            type: "number",
            value: income === "" ? "" : income,
            onChange: (e) => {
              const val = e.target.value;
              onChangeIncome(val === "" ? "" : Number(val));
            },
            placeholder: "0",
          }}
        />
      </FieldRow>

      <FieldRow label="특화 그룹">
        <CheckboxPills
          options={SPECIAL_GROUP_OPTIONS.map((v) => ({ label: v, value: v }))}
          values={specialGroup}
          onChange={onChangeSpecialGroup}
          readOnly={readOnly}
        />
      </FieldRow>

      <FieldRow label="관심 분야">
        <CheckboxPills
          options={INTEREST_OPTIONS.map((v) => ({ label: v, value: v }))}
          values={interests}
          onChange={onChangeInterests}
          readOnly={readOnly}
        />
      </FieldRow>
    </div>
  );
}
