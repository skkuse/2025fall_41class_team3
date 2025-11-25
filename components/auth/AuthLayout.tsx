import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#2f3440]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 py-12">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-[#1c2333]">{title}</h1>
          {description ? (
            <p className="mt-3 text-base text-[#5b6372]">{description}</p>
          ) : null}
        </header>

        <main className="mt-12 w-full max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
