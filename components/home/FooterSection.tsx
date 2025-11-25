interface FooterItem {
  title: string;
  body: string;
}

const footerItems: FooterItem[] = [
  { title: "서비스소개", body: "청년정책 LLM은 다양한 청년 정책을 제공합니다." },
  { title: "이용 약관", body: "서비스 사용을 위한 약관을 확인하세요." },
  { title: "문의", body: "kee711@g.skku.edu" },
];

export default function FooterSection() {
  return (
    <footer className="mt-auto border-t border-[#dfe1e4] bg-white/70 px-6 py-8 text-sm text-[#6f7784]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {footerItems.map((item) => (
          <div key={item.title} className="space-y-2">
            <p className="font-semibold text-[#5d6573]">{item.title}</p>
            <p className="text-[#8a919d]">{item.body}</p>
          </div>
        ))}
      </div>
    </footer>
  );
}
