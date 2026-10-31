"use client";
import { ReactNode, useCallback, useEffect, useState } from "react";

export async function api<T = Record<string, unknown>>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body || init?.form ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.form ?? (init?.body ? JSON.stringify(init.body) : undefined),
  });
  if (res.status === 401) {
    window.location.href = "/";
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [v, setV] = useState(0);
  const reload = useCallback(() => setV((x) => x + 1), []);
  useEffect(() => {
    if (!url) return;
    let off = false;
    api<T>(url).then((d) => !off && (setData(d), setError(""))).catch((e) => !off && setError(e.message));
    return () => { off = true; };
  }, [url, v]);
  return { data, error, reload, setData };
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) { const d = Math.round(-s / 86400); return d >= 1 ? `in ${d}d` : "soon"; }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type BtnProps = { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "outline"; disabled?: boolean; type?: "button" | "submit"; small?: boolean; className?: string; title?: string };
export function Btn({ children, onClick, variant = "primary", disabled, type = "button", small, className = "", title }: BtnProps) {
  const base = `inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${small ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"}`;
  const styles = {
    primary: "bg-gradient-to-r from-brand to-brand-2 text-white shadow-lg shadow-brand/20 hover:opacity-90",
    outline: "border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50",
    ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
    danger: "border border-red-500/30 text-red-300 hover:bg-red-500/10",
  }[variant];
  return <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>{children}</button>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <div className="font-medium text-zinc-200">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-brand" />
      {label}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-900/80" />)}</div>;
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>;
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "violet" | "cyan" }) {
  const t = { zinc: "bg-zinc-800 text-zinc-300", green: "bg-emerald-500/15 text-emerald-300", amber: "bg-amber-500/15 text-amber-300", red: "bg-red-500/15 text-red-300", violet: "bg-brand/15 text-violet-300", cyan: "bg-cyan-500/15 text-cyan-300" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:items-center" onMouseDown={onClose}>
      <div className={`glass fade-up my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-zinc-950/95 p-6 shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 text-xl leading-none text-zinc-500 hover:text-zinc-200" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Btn small variant="outline" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied ✓" : label}
    </Btn>
  );
}

export function Code({ children }: { children: string }) {
  return <pre className="scroll-thin overflow-x-auto rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-[12px] leading-relaxed text-zinc-300">{children}</pre>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </Card>
  );
}

export const MEMORY_TYPES = ["FACT", "DECISION", "PREFERENCE", "PROJECT_STATE", "TASK", "INSTRUCTION", "SUMMARY", "DOCUMENT_REFERENCE"] as const;
export const TYPE_STYLE: Record<string, { label: string; tone: "zinc" | "green" | "amber" | "red" | "violet" | "cyan"; icon: string }> = {
  FACT: { label: "Fact", tone: "cyan", icon: "◆" },
  DECISION: { label: "Decision", tone: "violet", icon: "✓" },
  PREFERENCE: { label: "Preference", tone: "amber", icon: "♥" },
  PROJECT_STATE: { label: "Project state", tone: "green", icon: "◷" },
  TASK: { label: "Task", tone: "amber", icon: "☐" },
  INSTRUCTION: { label: "Instruction", tone: "red", icon: "!" },
  SUMMARY: { label: "Summary", tone: "zinc", icon: "≡" },
  DOCUMENT_REFERENCE: { label: "Doc reference", tone: "cyan", icon: "↗" },
};
