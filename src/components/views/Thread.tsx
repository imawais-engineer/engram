"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, Badge, Btn, Card, Empty, ErrorNote, Field, MEMORY_TYPES, Modal, PageHeader, Skeleton, timeAgo, TYPE_STYLE, useLoad } from "../ui";
import { LibraryPicker } from "./Threads";

type Thread = { id: string; title: string; description: string; instructions: string; summary: string; libraryIds: string[]; updatedAt: string };
type Memory = { id: string; type: string; content: string; tags: string[]; source: string; createdAt: string; updatedAt: string };
type Lib = { id: string; name: string; icon: string };

export default function ThreadView({ id }: { id: string }) {
  const { data, error, reload } = useLoad<{ thread: Thread; memories: Memory[] }>(`/api/threads/${id}`);
  const libs = useLoad<{ libraries: Lib[] }>("/api/libraries");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Memory | "new" | null>(null);
  const [editMeta, setEditMeta] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of data?.memories ?? []) c[m.type] = (c[m.type] || 0) + 1;
    return c;
  }, [data]);

  if (error) return <Empty icon="🧵" title="Thread not found" body={error} action={<Link href="/threads"><Btn variant="outline">Back to threads</Btn></Link>} />;
  if (!data) return <Skeleton rows={4} />;
  const { thread, memories } = data;
  const shown = filter ? memories.filter((m) => m.type === filter) : memories;
  const linked = (libs.data?.libraries ?? []).filter((l) => thread.libraryIds.includes(l.id));

  async function del(m: Memory) {
    if (!confirm("Delete this memory?")) return;
    await api(`/api/memories/${m.id}`, { method: "DELETE" });
    reload();
  }
  async function delThread() {
    if (!confirm("Delete this thread and all its memories?")) return;
    await api(`/api/threads/${id}`, { method: "DELETE" });
    window.location.href = "/threads";
  }

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={<Link href="/threads" className="hover:text-zinc-300">← Threads</Link>}
        title={thread.title}
        subtitle={thread.description || `Active ${timeAgo(thread.updatedAt)}`}
        action={<><Btn variant="ghost" onClick={() => setEditMeta(true)}>Edit</Btn><Btn variant="danger" onClick={delThread}>Delete</Btn></>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1 text-xs ${!filter ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>All {memories.length}</button>
            {MEMORY_TYPES.filter((t) => counts[t]).map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`rounded-full px-3 py-1 text-xs ${filter === t ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{TYPE_STYLE[t].label} {counts[t]}</button>
            ))}
            <div className="ml-auto"><Btn small onClick={() => setEditing("new")}>+ Add memory</Btn></div>
          </div>
          {!shown.length && <Empty icon="🧠" title="No memories yet" body="Add decisions, facts and tasks here, or let a connected AI save them with the save_memory tool." action={<Btn onClick={() => setEditing("new")}>Add the first memory</Btn>} />}
          <div className="space-y-3">
            {shown.map((m) => {
              const s = TYPE_STYLE[m.type] ?? TYPE_STYLE.FACT;
              return (
                <Card key={m.id} className="group p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.icon} {s.label}</Badge>
                    {m.tags.map((t) => <span key={t} className="text-xs text-zinc-500">#{t}</span>)}
                    <span className="ml-auto text-xs text-zinc-500">via <span className={m.source === "dashboard" ? "text-zinc-400" : "text-cyan-300"}>{m.source}</span> · {timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="prose-pre text-sm leading-relaxed text-zinc-200">{m.content}</p>
                  <div className="mt-2 flex gap-3 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setEditing(m)} className="text-xs text-zinc-500 hover:text-zinc-200">Edit</button>
                    <button onClick={() => del(m)} className="text-xs text-zinc-500 hover:text-red-300">Delete</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Instructions</div>
            <p className="prose-pre text-sm text-zinc-300">{thread.instructions || <span className="text-zinc-600">None. Add rules every AI should follow.</span>}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Summary</div>
            <p className="prose-pre text-sm text-zinc-300">{thread.summary || <span className="text-zinc-600">No summary yet.</span>}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Linked libraries</div>
            {linked.length ? <div className="space-y-1">{linked.map((l) => <Link key={l.id} href={`/libraries/${l.id}`} className="block text-sm text-violet-300 hover:underline">{l.icon} {l.name}</Link>)}</div> : <p className="text-sm text-zinc-600">None linked.</p>}
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Use from any AI</div>
            <p className="text-sm text-zinc-400">Ask your AI: <span className="text-zinc-200">&ldquo;Load my Engram thread {thread.title} and continue.&rdquo;</span></p>
            <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">threadId: {thread.id}</p>
            <Link href="/connect" className="mt-3 inline-block text-xs text-cyan-300 hover:underline">Create a key for this thread →</Link>
          </Card>
        </aside>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add memory" : "Edit memory"}>
        {editing && <MemoryForm threadId={id} memory={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); reload(); }} />}
      </Modal>
      <Modal open={editMeta} onClose={() => setEditMeta(false)} title="Edit thread">
        <ThreadForm thread={thread} libs={libs.data?.libraries ?? []} onDone={() => { setEditMeta(false); reload(); }} />
      </Modal>
    </div>
  );
}

function MemoryForm({ threadId, memory, onDone }: { threadId: string; memory?: Memory; onDone: () => void }) {
  const [type, setType] = useState(memory?.type ?? "DECISION");
  const [content, setContent] = useState(memory?.content ?? "");
  const [tags, setTags] = useState(memory?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (memory) await api(`/api/memories/${memory.id}`, { method: "PATCH", body: { type, content, tags } });
      else await api(`/api/threads/${threadId}/memories`, { body: { type, content, tags } });
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Type">
        <div className="flex flex-wrap gap-1.5">{MEMORY_TYPES.map((t) => <button type="button" key={t} onClick={() => setType(t)} className={`rounded-full border px-2.5 py-1 text-xs ${type === t ? "border-brand bg-brand/20 text-white" : "border-zinc-800 text-zinc-400"}`}>{TYPE_STYLE[t].icon} {TYPE_STYLE[t].label}</button>)}</div>
      </Field>
      <Field label="Content"><textarea className="input min-h-32" autoFocus required value={content} onChange={(e) => setContent(e.target.value)} placeholder="We chose Appwrite Realtime for rider locations instead of polling." /></Field>
      <Field label="Tags" hint="Comma separated"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="architecture, realtime" /></Field>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Save memory"}</Btn></div>
    </form>
  );
}

function ThreadForm({ thread, libs, onDone }: { thread: Thread; libs: Lib[]; onDone: () => void }) {
  const [f, setF] = useState({ title: thread.title, description: thread.description, instructions: thread.instructions, summary: thread.summary, libraryIds: thread.libraryIds });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`/api/threads/${thread.id}`, { method: "PATCH", body: f }); onDone(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Title"><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Description"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Instructions"><textarea className="input min-h-24" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
      <Field label="Summary"><textarea className="input min-h-24" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
      <Field label="Linked libraries"><LibraryPicker libs={libs} value={f.libraryIds} onChange={(libraryIds) => setF({ ...f, libraryIds })} /></Field>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Btn></div>
    </form>
  );
}
