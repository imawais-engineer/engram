"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, Badge, Btn, Card, Empty, ErrorNote, Field, Modal, PageHeader, Skeleton, Spinner, timeAgo, useLoad } from "../ui";
import { LibraryForm } from "./Libraries";

type Doc = { id: string; title: string; sourceType: string; mimeType: string; size: number; status: string; error: string; chunkCount: number; createdAt: string };
type Lib = { id: string; name: string; description: string; icon: string };
type Hit = { documentId: string; documentTitle: string; chunkIndex: number; text: string; score: number };

const statusTone = (s: string) => (s === "indexed" ? "green" : s === "failed" ? "red" : "amber") as "green" | "red" | "amber";
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export default function LibraryView({ id }: { id: string }) {
  const { data, error, reload } = useLoad<{ library: Lib; documents: Doc[] }>(`/api/libraries/${id}`);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploadErr, setUploadErr] = useState("");
  const [showText, setShowText] = useState(false);
  const [edit, setEdit] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [ms, setMs] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | File[]) {
    setUploadErr("");
    for (const f of Array.from(files)) {
      setUploading((u) => [...u, f.name]);
      try {
        const form = new FormData();
        form.append("file", f);
        const r = await api<{ document: Doc }>(`/api/libraries/${id}/documents`, { form });
        if (r.document.status === "failed") setUploadErr(`${f.name}: ${r.document.error}`);
      } catch (e) { setUploadErr(`${f.name}: ${(e as Error).message}`); }
      setUploading((u) => u.filter((n) => n !== f.name));
      reload();
    }
  }
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    const t = performance.now();
    try { setHits((await api<{ results: Hit[] }>("/api/search", { body: { query: q, libraryIds: [id] } })).results); setMs(Math.round(performance.now() - t)); }
    catch (e) { setUploadErr((e as Error).message); }
    setSearching(false);
  }
  async function del(doc: Doc) {
    if (!confirm(`Delete "${doc.title}" and its ${doc.chunkCount} chunks?`)) return;
    await api(`/api/documents/${doc.id}`, { method: "DELETE" });
    reload();
  }
  async function delLib() {
    if (!confirm("Delete this library, all its documents and chunks? This can't be undone.")) return;
    await api(`/api/libraries/${id}`, { method: "DELETE" });
    window.location.href = "/libraries";
  }

  if (error) return <Empty icon="🔍" title="Library not found" body={error} action={<Link href="/libraries"><Btn variant="outline">Back to libraries</Btn></Link>} />;
  if (!data) return <Skeleton rows={4} />;
  const { library, documents } = data;
  const chunks = documents.reduce((s, d) => s + d.chunkCount, 0);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={<Link href="/libraries" className="hover:text-zinc-300">← Libraries</Link>}
        title={<span className="flex items-center gap-3"><span>{library.icon}</span>{library.name}</span>}
        subtitle={library.description || `${documents.length} documents · ${chunks} chunks`}
        action={<><Btn variant="ghost" onClick={() => setEdit(true)}>Edit</Btn><Btn variant="danger" onClick={delLib}>Delete</Btn></>}
      />

      <form onSubmit={search} className="glass mb-6 flex items-center gap-2 rounded-2xl p-2">
        <span className="pl-3 text-zinc-500">⌕</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask this library anything — search by meaning, not keywords" className="flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-500" />
        {hits && <button type="button" onClick={() => { setHits(null); setQ(""); }} className="px-2 text-xs text-zinc-500 hover:text-zinc-300">Clear</button>}
        <Btn type="submit" disabled={searching || !chunks}>{searching ? "Searching…" : "Search"}</Btn>
      </form>

      {hits && (
        <section className="mb-8">
          <div className="mb-3 text-xs text-zinc-500">{hits.length} passages · {ms} ms · Appwrite Embeddings + TablesDB</div>
          {!hits.length && <Card className="p-5 text-sm text-zinc-400">No close matches. Try rephrasing.</Card>}
          <div className="space-y-3">
            {hits.map((h, i) => (
              <Card key={i} className="p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <button onClick={() => setViewing(h.documentId)} className="truncate text-sm font-medium text-violet-300 hover:underline">{h.documentTitle} <span className="text-zinc-500">#{h.chunkIndex}</span></button>
                  <span className="font-mono text-[11px] text-zinc-500">{Math.round(h.score * 100)}% match</span>
                </div>
                <p className="prose-pre text-sm leading-relaxed text-zinc-300">{h.text}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`mb-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition sm:flex-row sm:justify-between sm:text-left ${drag ? "border-cyan-300 bg-cyan-500/10" : "border-lilac/25 bg-white/[0.02]"}`}
      >
        <div>
          <div className="font-medium text-zinc-200">Add knowledge</div>
          <div className="text-sm text-zinc-500">Drop PDF, Markdown or TXT files (up to 10 MB), or paste text. Files go to Appwrite Storage; text is chunked and embedded.</div>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" multiple accept=".pdf,.md,.markdown,.txt" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          <Btn onClick={() => fileRef.current?.click()}>Upload files</Btn>
          <Btn variant="outline" onClick={() => setShowText(true)}>Paste text</Btn>
        </div>
      </div>
      {uploading.map((n) => <div key={n} className="mb-3"><Card className="flex items-center justify-between p-3"><span className="text-sm text-zinc-300">{n}</span><Spinner label="Extracting, chunking and embedding…" /></Card></div>)}
      <ErrorNote error={uploadErr} />

      {!documents.length && !uploading.length && <Empty icon="📄" title="No documents yet" body="Upload a spec, architecture doc or meeting notes to make them searchable from your connected AI tools." />}
      {documents.length > 0 && (
        <Card className="divide-y divide-lilac/15 overflow-hidden">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lilac/15 bg-white/[0.05] text-[10px] font-semibold uppercase text-zinc-400">{d.mimeType.includes("pdf") ? "PDF" : d.sourceType === "upload" ? "FILE" : "TXT"}</div>
              <button onClick={() => setViewing(d.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-zinc-100">{d.title}</div>
                <div className="mono-app mt-0.5 text-zinc-500">{d.chunkCount} chunks · {fmtSize(d.size)} · {timeAgo(d.createdAt)}{d.error && <span className="text-red-400"> · {d.error}</span>}</div>
              </button>
              <Badge tone={statusTone(d.status)}>{d.status}</Badge>
              <button onClick={() => del(d)} className="text-xs text-zinc-500 hover:text-red-300">Delete</button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={showText} onClose={() => setShowText(false)} title="Paste text"><TextDoc libraryId={id} onDone={() => { setShowText(false); reload(); }} /></Modal>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit library"><LibraryForm initial={library} onDone={() => { setEdit(false); reload(); }} /></Modal>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Document" wide>{viewing && <DocViewer id={viewing} />}</Modal>
    </div>
  );
}

function TextDoc({ libraryId, onDone }: { libraryId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await api<{ document: Doc }>(`/api/libraries/${libraryId}/documents`, { body: { title, content } });
      if (r.document.status === "failed") throw new Error(r.document.error);
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Title"><input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Standup notes, 31 Oct" /></Field>
      <Field label="Content"><textarea className="input min-h-56" required value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste notes, a README, a chat transcript…" /></Field>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Indexing…" : "Add to library"}</Btn></div>
    </form>
  );
}

function DocViewer({ id }: { id: string }) {
  const { data, error } = useLoad<{ document: Doc & { content: string } }>(`/api/documents/${id}`);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner label="Loading…" />;
  const d = data.document;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{d.title}</span>
        <Badge tone={statusTone(d.status)}>{d.status}</Badge>
        <Badge>{d.chunkCount} chunks</Badge>
        <span className="font-mono text-[11px] text-zinc-500">engram://documents/{d.id}</span>
      </div>
      <pre className="prose-pre scroll-thin max-h-[60vh] overflow-y-auto rounded-lg bg-[#03040b]/50 p-4 font-sans text-sm leading-relaxed text-zinc-300">{d.content || "(no extracted text)"}</pre>
    </div>
  );
}
