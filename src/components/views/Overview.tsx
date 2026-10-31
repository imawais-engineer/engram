"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Badge, Btn, Card, ErrorNote, PageHeader, Skeleton, Stat, timeAgo, useLoad } from "../ui";

type O = {
  counts: { libraries: number; documents: number; chunks: number; threads: number; memories: number; activeKeys: number };
  recentThreads: { id: string; title: string; memoryCount: number; updatedAt: string }[];
  recentDocuments: { id: string; title: string; libraryId: string; status: string; createdAt: string }[];
  libraries: { id: string; name: string; icon: string }[];
  keys: { id: string; name: string; status: string; lastUsedAt: string | null }[];
  activity: { id: string; keyName: string; action: string; detail: string; status: string; createdAt: string }[];
};

export default function OverviewView() {
  const { data, error, reload } = useLoad<O>("/api/overview");
  const legacy = useLoad<{ count: number }>("/api/import-notes");
  const [importing, setImporting] = useState(false);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton rows={4} />;
  const c = data.counts;
  const steps = [
    { done: c.libraries > 0 && c.documents > 0, label: "Add a library and upload a document", href: "/libraries" },
    { done: c.threads > 0, label: "Start a thread for your project", href: "/threads" },
    { done: c.activeKeys > 0, label: "Create a key and connect an AI tool", href: "/connect" },
    { done: data.activity.some((a) => a.action.startsWith("tool.")), label: "Make your first MCP call", href: "/connect" },
  ];
  const libName = new Map(data.libraries.map((l) => [l.id, l]));

  return (
    <div className="fade-up">
      <PageHeader title="Overview" subtitle="Your memory layer, shared by every AI tool you connect." action={<Link href="/connect"><Btn variant="outline">Manage keys</Btn></Link>} />
      {(legacy.data?.count ?? 0) > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-brand/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-300">You have <b>{legacy.data!.count}</b> notes from NoteMind. Move them into a “Notes” library so AI tools can search them.</div>
          <Btn small disabled={importing} onClick={async () => { setImporting(true); await api("/api/import-notes", { method: "POST" }); setImporting(false); legacy.reload(); reload(); }}>{importing ? "Importing…" : "Import notes"}</Btn>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Libraries" value={c.libraries} hint={`${c.documents} documents`} />
        <Stat label="Indexed chunks" value={c.chunks} hint="768-dim vectors" />
        <Stat label="Threads" value={c.threads} hint={`${c.memories} memories`} />
        <Stat label="Active keys" value={c.activeKeys} hint="MCP connections" />
      </div>

      {steps.some((s) => !s.done) && (
        <Card className="mt-6 p-5">
          <div className="mono-app mb-3 text-lilac">Get set up</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <Link key={i} href={s.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${s.done ? "text-zinc-500 line-through" : "text-zinc-200 hover:bg-white/5"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${s.done ? "bg-emerald-500/20 text-emerald-300" : "border border-zinc-700 text-zinc-500"}`}>{s.done ? "✓" : i + 1}</span>
                {s.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><span className="mono-app text-lilac">Recent threads</span><Link href="/threads" className="mono-app text-lilac hover:text-cream">All threads →</Link></div>
          {!data.recentThreads.length && <p className="text-sm text-zinc-600">No threads yet.</p>}
          <div className="divide-y divide-lilac/15">
            {data.recentThreads.map((t) => (
              <Link key={t.id} href={`/threads/${t.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-white">
                <span className="truncate text-zinc-200">🧵 {t.title}</span>
                <span className="mono-app shrink-0 text-zinc-500">{t.memoryCount} memories · {timeAgo(t.updatedAt)}</span>
              </Link>
            ))}
          </div>
          <div className="mb-3 mt-6 flex items-center justify-between"><span className="mono-app text-lilac">Recent documents</span><Link href="/libraries" className="mono-app text-lilac hover:text-cream">All libraries →</Link></div>
          {!data.recentDocuments.length && <p className="text-sm text-zinc-600">No documents yet.</p>}
          <div className="divide-y divide-lilac/15">
            {data.recentDocuments.map((d) => (
              <Link key={d.id} href={`/libraries/${d.libraryId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate text-zinc-200">{libName.get(d.libraryId)?.icon ?? "📄"} {d.title}</span>
                <span className="flex shrink-0 items-center gap-2 mono-app text-zinc-500"><Badge tone={d.status === "indexed" ? "green" : d.status === "failed" ? "red" : "amber"}>{d.status}</Badge>{timeAgo(d.createdAt)}</span>
              </Link>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><span className="mono-app text-lilac">Keys</span><Link href="/connect" className="mono-app text-lilac hover:text-cream">Manage →</Link></div>
            {!data.keys.length && <p className="text-sm text-zinc-600">No AI tools connected yet.</p>}
            {data.keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2 truncate text-zinc-300"><span className={`h-2 w-2 rounded-full ${k.status === "active" ? "bg-emerald-400" : "bg-zinc-600"}`} />{k.name}</span>
                <span className="mono-app text-zinc-500">{k.status === "active" ? `used ${timeAgo(k.lastUsedAt)}` : k.status}</span>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <div className="mono-app mb-3 text-lilac">Live activity</div>
            {!data.activity.length && <p className="text-sm text-zinc-600">Tool calls from connected AIs appear here.</p>}
            <div className="space-y-2">
              {data.activity.slice(0, 8).map((a) => (
                <div key={a.id} className="text-xs">
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${a.status === "ok" ? "bg-emerald-400" : a.status === "denied" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className="text-cyan-300">{a.keyName}</span> <span className="font-mono text-zinc-300">{a.action.replace(/^tool\./, "")}</span>
                  <span className="mono-app float-right text-zinc-500">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
