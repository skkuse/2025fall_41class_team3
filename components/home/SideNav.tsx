import { useRouter } from "next/navigation";
import { clearAuthCookies } from "@/lib/auth/tokenClient";

interface SideNavProps {
  active?: "home" | "mypage" | "discover";
}

const menus: { label: string; key: SideNavProps["active"]; dimmed?: boolean }[] =
  [
    { label: "Home", key: "home" },
    { label: "Mypage", key: "mypage", dimmed: true },
    { label: "Discover", key: "discover", dimmed: true },
  ];

export default function SideNav({ active = "home" }: SideNavProps) {
  const router = useRouter();

  const handleSignOut = () => {
    clearAuthCookies();
    router.replace("/auth/signin");
  };

  return (
    <aside className="hidden min-h-screen w-56 flex-col border-r border-[#d8dadd] bg-white/60 px-10 pt-16 text-sm text-[#9ba0a7] sm:flex">
      <nav className="flex flex-col gap-6">
        {menus.map((item) => {
          const isActive = item.key === active;
          return (
            <span
              key={item.label}
              className={`transition ${
                isActive
                  ? "text-[#5c6674]"
                  : item.dimmed
                    ? "text-[#c2c7ce]"
                    : "text-[#aab0b7]"
              }`}
            >
              {item.label}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto pb-10">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-md border border-[#d8dadd] bg-white px-4 py-2 text-left text-sm font-semibold text-[#5c6674] transition hover:border-[#2f6bff] hover:text-[#2f6bff]"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
