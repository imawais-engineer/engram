"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Logo from "./Logo";

const NAV = [
  { href: "/overview", label: "Overview", icon: "◎" },
  { href: "/libraries", label: "Libraries", icon: "▤" },
  { href: "/threads", label: "Threads", icon: "⌘" },
  { href: "/connect", label: "Connect", icon: "⚿" },
];

export default function Shell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const path = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-zinc-950/60 p-4 backdrop-blur md:flex">
        <Link href="/overview" className="mb-8 px-2 pt-1"><Logo /></Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}>
                <span className={`w-4 text-center ${active ? "text-brand-2" : "text-zinc-500"}`}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="truncate text-sm font-medium text-zinc-200">{user.name}</div>
          <div className="truncate text-xs text-zinc-500">{user.email}</div>
          <button onClick={logout} className="mt-2 text-xs text-zinc-500 hover:text-zinc-200">Sign out</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-zinc-950/80 px-4 py-3 backdrop-blur md:hidden">
          <Logo size={24} />
          <button onClick={logout} className="text-xs text-zinc-500">Sign out</button>
        </header>
        <nav className="sticky top-[49px] z-20 flex gap-1 overflow-x-auto border-b border-white/5 bg-zinc-950/80 px-2 py-2 backdrop-blur md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${path.startsWith(n.href) ? "bg-white/10 text-white" : "text-zinc-400"}`}>{n.label}</Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
