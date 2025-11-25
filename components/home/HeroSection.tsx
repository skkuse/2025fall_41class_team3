interface HeroSectionProps {
  userName?: string;
  serviceName?: string;
}

export default function HeroSection({
  userName = "000",
  serviceName = "[서비스명]",
}: HeroSectionProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-[#555c69]">
      <p className="text-[28px] font-bold text-[#4a5160]">
        안녕하세요 {userName}님:)
      </p>
      <p className="text-lg text-[#5f6674]">
        {serviceName}이 나의 상황에 꼭 맞는 정책을 찾아드립니다.
      </p>
    </div>
  );
}
