"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Btn, Card, Empty, ErrorNote, Field, Modal, PageHeader, Skeleton, timeAgo, useLoad } from "../ui";

type Thread = { id: string; title: string; description: string; libraryIds: string[]; memoryCount: number; updatedAt: string; status: string };
type Lib = { id: string; name: string; icon: string };

export function LibraryPicker({ libs, value, onChange }: { libs: Lib[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!libs.length) return <p className="text-sm text-zinc-500">No libraries yet. You can link them later.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {libs.map((l) => {
        const on = value.includes(l.id);
        return <button type="button" key={l.id} onClick={() => onChange(on ? value.filter((x) => x !== l.id) : [...value, l.id])} className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-brand bg-brand/20 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>{l.icon} {l.name}</button>;
      })}
    </div>
  );
}

export default function ThreadsView() {
  const { data, error } = useLoad<{ threads: Thread[] }>("/api/threads");
  const libs = useLoad<{ libraries: Lib[] }>("/api/libraries");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const libName = new Map((libs.data?.libraries ?? []).map((l) => [l.id, `${l.icon} ${l.name}`]));

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api<{ thread: Thread }>("/api/threads", { body: { title, description, instructions, libraryIds } });
      window.location.href = `/threads/${r.thread.id}`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fade-up">
      <PageHeader title="Threads" subtitle="Long-running context for a project or task: instructions, a running summary and typed memories that every AI tool can load and add to." action={<Btn onClick={() => setOpen(true)}>+ New thread</Btn>} />
      <ErrorNote error={error} />
      {!data && !error && <Skeleton rows={3} />}
      {data && !data.threads.length && <Empty icon="🧵" title="No threads yet" body="A thread is where AI tools pick up where the last one left off. Create one per project." action={<Btn onClick={() => setOpen(true)}>Start a thread</Btn>} />}
      {data && data.threads.length > 0 && (
        <div className="space-y-3">
          {data.threads.map((t) => (
            <Link key={t.id} href={`/threads/${t.id}`} className="block">
              <Card className="flex flex-col gap-2 p-5 transition hover:border-brand/40 hover:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-white">{t.title}</div>
                  <div className="mt-0.5 truncate text-sm text-zinc-400">{t.description || "No description"}</div>
                  {t.libraryIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{t.libraryIds.map((id) => libName.get(id) && <span key={id} className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">{libName.get(id)}</span>)}</div>}
                </div>
                <div className="flex shrink-0 gap-4 text-xs text-zinc-500"><span>{t.memoryCount} memories</span><span>active {timeAgo(t.updatedAt)}</span></div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New thread">
        <form onSubmit={create}>
          <Field label="Title"><input className="input" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Atlas MVP build" /></Field>
          <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shipping the courier-tracking MVP before Eid" /></Field>
          <Field label="Instructions for AI tools" hint="Every connected AI reads these first."><textarea className="input min-h-24" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Use TypeScript. Keep MVP scope tight. Ask before adding dependencies." /></Field>
          <Field label="Linked libraries"><LibraryPicker libs={libs.data?.libraries ?? []} value={libraryIds} onChange={setLibraryIds} /></Field>
          <ErrorNote error={err} />
          <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Creating…" : "Create thread"}</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
