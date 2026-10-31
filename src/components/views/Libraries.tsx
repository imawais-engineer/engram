"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Btn, Card, Empty, ErrorNote, Field, Modal, PageHeader, Skeleton, timeAgo, useLoad } from "../ui";

type Lib = { id: string; name: string; description: string; icon: string; documentCount: number; chunkCount: number; updatedAt: string };
const ICONS = ["📚", "🧠", "🛠️", "📁", "🧪", "📝", "🚀", "💼", "🎓", "🔬"];

export function LibraryForm({ initial, onDone }: { initial?: Partial<Lib>; onDone: (lib: Lib) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "📚");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = initial?.id
        ? await api<{ library: Lib }>(`/api/libraries/${initial.id}`, { method: "PATCH", body: { name, description, icon } })
        : await api<{ library: Lib }>("/api/libraries", { body: { name, description, icon } });
      onDone(r.library);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Icon">
        <div className="flex flex-wrap gap-1.5">{ICONS.map((i) => <button type="button" key={i} onClick={() => setIcon(i)} className={`h-9 w-9 rounded-lg text-lg ${icon === i ? "bg-violet/30 ring-1 ring-violet-300" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}>{i}</button>)}</div>
      </Field>
      <Field label="Name"><input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Project Atlas" /></Field>
      <Field label="Description" hint="Shown to AI tools so they know when to search this library."><textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Specs, architecture notes and meeting notes for Atlas" /></Field>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Saving…" : initial?.id ? "Save" : "Create library"}</Btn></div>
    </form>
  );
}

export default function LibrariesView() {
  const { data, error } = useLoad<{ libraries: Lib[] }>("/api/libraries");
  const [open, setOpen] = useState(false);
  return (
    <div className="fade-up">
      <PageHeader title="Libraries" subtitle="Collections of documents, chunked and embedded so any connected AI can search them by meaning." action={<Btn onClick={() => setOpen(true)}>+ New library</Btn>} />
      <ErrorNote error={error} />
      {!data && !error && <Skeleton rows={3} />}
      {data && !data.libraries.length && <Empty icon="📚" title="No libraries yet" body="Create a library, then upload PDFs, Markdown or text. Engram indexes them with Appwrite Embeddings." action={<Btn onClick={() => setOpen(true)}>Create your first library</Btn>} />}
      {data && data.libraries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.libraries.map((l) => (
            <Link key={l.id} href={`/libraries/${l.id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-violet-300/40 hover:shadow-[0_20px_60px_-25px_rgba(124,92,255,0.7)]">
                <div className="flex items-start justify-between">
                  <div className="text-2xl">{l.icon}</div>
                  <span className="mono-app text-zinc-500">{timeAgo(l.updatedAt)}</span>
                </div>
                <div className="mt-3 font-medium text-white">{l.name}</div>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-400">{l.description || "No description"}</p>
                <div className="mt-4 flex gap-4 text-xs text-zinc-500"><span>{l.documentCount} docs</span><span>{l.chunkCount} chunks</span></div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New library">
        <LibraryForm onDone={(l) => (window.location.href = `/libraries/${l.id}`)} />
      </Modal>
    </div>
  );
}
