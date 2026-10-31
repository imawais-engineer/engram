"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Logo from "./Logo";
import { Initials } from "./ui";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/libraries", label: "Libraries" },
  { href: "/threads", label: "Threads" },
  { href: "/skills", label: "Skills" },
  { href: "/agents", label: "Agents" },
  { href: "/connect", label: "Connect" },
];

export default function Shell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-lilac/20 bg-plum/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:flex-nowrap md:px-8">
          <Link href="/overview" aria-label="Engram overview"><Logo size={20} /></Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:ml-6 md:w-auto">
            {NAV.map((n) => {
              const active = path === n.href || path.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={`mono-app whitespace-nowrap rounded-lg px-3 py-2 transition ${active ? "bg-violet text-cream" : "text-lilac hover:text-cream"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/connect" className="hidden rounded-full bg-pink px-4 py-2 text-[13px] font-semibold text-plum transition hover:brightness-110 sm:inline-flex">Connect an AI</Link>
            <div className="flex items-center gap-2" title={user.email}>
              <Initials name={user.name} />
              <button onClick={logout} className="mono-app text-lilac hover:text-cream">Sign out</button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-lilac/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 md:px-8">
          <span className="mono-app text-lilac">Engram · one memory for every AI</span>
          <span className="mono-app text-lilac">Keys stored as SHA-256 hashes · per-user row permissions</span>
        </div>
      </footer>
    </div>
  );
}
