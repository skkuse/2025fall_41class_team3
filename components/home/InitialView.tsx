import HeroSection from "./HeroSection";
import PromptInput from "./PromptInput";

interface InitialViewProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function InitialView({
  prompt,
  onPromptChange,
  onSubmit,
  loading,
}: InitialViewProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-14 px-6 pb-14 pt-10">
      <HeroSection />
      <PromptInput
        value={prompt}
        onChange={onPromptChange}
        onSubmit={onSubmit}
        loading={loading}
        helperText="Mypage에서 내 정보를 정확히 입력하면, 더 정확한 정책 추천을 받을 수 있습니다."
      />
    </section>
  );
}
