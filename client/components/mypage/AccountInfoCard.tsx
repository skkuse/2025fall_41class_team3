import FieldRow from "@/components/common/FieldRow";
import TextInput from "@/components/common/TextInput";

interface AccountInfoCardProps {
  email: string;
  password: string;
  readOnly: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export default function AccountInfoCard({
  email,
  password,
  readOnly,
  onEmailChange,
  onPasswordChange,
}: AccountInfoCardProps) {
  const displayPassword = readOnly ? "************" : password;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#e2e5ea] bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,0,0,0.04)]">
      <FieldRow label="이메일">
        <TextInput
          readOnly={readOnly}
          inputProps={{
            type: "email",
            value: email,
            onChange: (e) => onEmailChange(e.target.value),
            placeholder: "이메일을 입력하세요",
          }}
        />
      </FieldRow>
      <FieldRow label="비밀번호">
        <TextInput
          readOnly={readOnly}
          inputProps={{
            type: readOnly ? "text" : "password",
            value: displayPassword,
            onChange: (e) => onPasswordChange(e.target.value),
            placeholder: "************",
          }}
        />
      </FieldRow>
    </div>
  );
}
