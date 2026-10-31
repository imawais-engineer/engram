"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";

type Note = { id: string; title: string; content: string; subject: string; tags: string[]; createdAt: string; score?: number };

const EXAMPLES = [
  "how do inner functions remember variables",
  "why is my program stuck waiting forever",
  "fastest way to order a list",
  "make my database queries faster",
  "what to say in the daily meeting",
];

const SUBJECT_COLORS = ["#fd366e", "#a855f7", "#22d3ee", "#34d399", "#fbbf24", "#f97316", "#60a5fa", "#e879f9"];
function subjectColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

function Match({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2" title="Cosine similarity">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${Math.max(5, Math.min(100, (score - 0.4) / 0.5 * 100))}%` }} />
      </div>
      <span className="font-mono text-[11px] text-zinc-400">{pct}%</span>
    </div>
  );
}

function SubjectPill({ subject }: { subject: string }) {
  const c = subjectColor(subject);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${c}1f`, color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {subject}
    </span>
  );
}

export default function NotesApp({ user }: { user: { name: string; email: string } }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [query, setQuery] = useState("");
  const [rawResults, setResults] = useState<Note[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMs, setSearchMs] = useState<number | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detailState, setDetail] = useState<{ note: Note; related: Note[] } | null>(null);
  const detail = selected && detailState?.note.id === selected ? detailState : null;
  const detailLoading = !!selected && !detail;
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  const [version, setVersion] = useState(0);
  const loadNotes = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notes")
      .then(async (r) => {
        if (r.status === 401) return window.location.reload();
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load notes");
        if (!cancelled) setNotes(d.notes ?? []);
      })
      .catch((e) => !cancelled && (setNotes((n) => n ?? []), setError(e.message)));
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowNew(false);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced semantic search
  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (!q) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q });
        if (subject) params.set("subject", subject);
        const r = await fetch(`/api/search?${params}`);
        const d = await r.json();
        if (seq !== searchSeq.current) return;
        if (!r.ok) throw new Error(d.error);
        setResults(d.results);
        setSearchMs(d.ms);
        setError("");
      } catch (e) {
        if (seq === searchSeq.current) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, subject]);

  // Load note + related notes
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/notes/${selected}`)
      .then((r) => r.json())
      .then((d) => !cancelled && d.note && setDetail(d));
    return () => {
      cancelled = true;
    };
  }, [selected, version]);

  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes ?? []) m.set(n.subject, (m.get(n.subject) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const results = query.trim() ? rawResults : null;
  const list = results ?? (notes ?? []).filter((n) => !subject || n.subject === subject);

  async function seed() {
    setSeeding(true);
    setError("");
    const r = await fetch("/api/seed", { method: "POST" });
    if (!r.ok) setError((await r.json()).error || "Could not add samples");
    await loadNotes();
    setSeeding(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setSelected(null);
    setResults((r) => r?.filter((n) => n.id !== id) ?? null);
    loadNotes();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNew(true)} className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-brand/20 transition hover:opacity-90">
              + New note
            </button>
            <div className="hidden text-right text-xs sm:block">
              <div className="text-zinc-200">{user.name}</div>
              <div className="text-zinc-500">{user.email}</div>
            </div>
            <button onClick={logout} className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-12">
        <section className="pt-10 pb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">What do you want to remember?</h1>
          <p className="mt-2 text-sm text-zinc-400">Ask in your own words. NoteMind ranks your notes by meaning.</p>
          <div className="relative mx-auto mt-6 max-w-2xl">
            <svg className="pointer-events-none absolute z-10 left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. why is my program stuck waiting forever"
              className="glass w-full rounded-2xl py-4 pl-12 pr-24 text-base text-zinc-100 shadow-2xl shadow-black/40 outline-none transition placeholder:text-zinc-500 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {searching && query.trim() ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-brand" />
              ) : query ? (
                <button onClick={() => setQuery("")} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
              ) : (
                <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Ctrl K</kbd>
              )}
            </div>
          </div>
          {!query && (notes?.length ?? 0) > 0 && (
            <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setQuery(ex)} className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400 transition hover:border-brand/40 hover:text-zinc-200">
                  {ex}
                </button>
              ))}
            </div>
          )}
        </section>

        {subjects.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button onClick={() => setSubject("")} className={`rounded-full px-3 py-1 text-xs transition ${!subject ? "bg-zinc-100 text-zinc-900" : "border border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              All · {notes?.length}
            </button>
            {subjects.map(([s, n]) => (
              <button key={s} onClick={() => setSubject(subject === s ? "" : s)} className={`rounded-full px-3 py-1 text-xs transition ${subject === s ? "bg-zinc-100 text-zinc-900" : "border border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                {s} · {n}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        {notes === null ? (
          <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="glass h-28 animate-pulse rounded-xl" />)}</div>
        ) : notes.length === 0 ? (
          <div className="glass fade-up mx-auto max-w-xl rounded-2xl p-10 text-center">
            <div className="text-4xl">🧠</div>
            <h2 className="mt-4 text-lg font-semibold text-white">Your notebook is empty</h2>
            <p className="mt-2 text-sm text-zinc-400">Add your first note, or load 10 sample computer-science notes to try semantic search right away.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => setShowNew(true)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">Write a note</button>
              <button onClick={seed} disabled={seeding} className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {seeding ? "Embedding notes…" : "Load sample notes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <section>
              <div className="mb-3 flex items-baseline justify-between text-xs text-zinc-500">
                <span className="font-medium uppercase tracking-wide">
                  {results ? `${results.length} matches by meaning` : "All notes"}
                </span>
                {results && searchMs !== null && <span className="font-mono">semantic search · {searchMs} ms</span>}
              </div>
              <div className="space-y-2.5">
                {results && results.length === 0 && !searching && (
                  <div className="glass rounded-xl p-6 text-center text-sm text-zinc-400">No notes are close in meaning. Try rephrasing, or add a note about it.</div>
                )}
                {list.map((n, i) => (
                  <button
                    key={n.id}
                    onClick={() => setSelected(n.id)}
                    style={{ animationDelay: `${i * 30}ms` }}
                    className={`fade-up glass block w-full rounded-xl p-4 text-left transition hover:border-white/15 hover:bg-zinc-900/80 ${selected === n.id ? "!border-brand/50 ring-1 ring-brand/30" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-zinc-100">{n.title}</h3>
                      {n.score !== undefined && <Match score={n.score} />}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-zinc-400">{n.content}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <SubjectPill subject={n.subject} />
                      {n.tags.map((t) => <span key={t} className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">#{t}</span>)}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="lg:sticky lg:top-20 lg:self-start">
              {!selected ? (
                <div className="glass grid h-64 place-items-center rounded-2xl p-8 text-center text-sm text-zinc-500">
                  <div>
                    <div className="text-3xl">📖</div>
                    <p className="mt-3">Select a note to read it and see its related notes.</p>
                  </div>
                </div>
              ) : detailLoading && !detail ? (
                <div className="glass h-80 animate-pulse rounded-2xl" />
              ) : detail ? (
                <article className="glass fade-up rounded-2xl p-6" key={detail.note.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <SubjectPill subject={detail.note.subject} />
                      <h2 className="mt-3 text-xl font-semibold text-white">{detail.note.title}</h2>
                      <p className="mt-1 text-xs text-zinc-500">{new Date(detail.note.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditing(detail.note)} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">Edit</button>
                      <button onClick={() => remove(detail.note.id)} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-300">Delete</button>
                    </div>
                  </div>
                  <div className="scroll-thin mt-5 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{detail.note.content}</div>
                  {detail.note.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {detail.note.tags.map((t) => <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">#{t}</span>)}
                    </div>
                  )}
                  <div className="mt-6 border-t border-white/5 pt-5">
                    <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Related notes
                    </h3>
                    {detail.related.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-500">Nothing closely related yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {detail.related.map((r) => (
                          <li key={r.id}>
                            <button onClick={() => setSelected(r.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 text-left transition hover:border-brand/40">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-zinc-200">{r.title}</div>
                                <div className="mt-0.5 text-[11px] text-zinc-500">{r.subject}</div>
                              </div>
                              {r.score !== undefined && <Match score={r.score} />}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              ) : null}
            </aside>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-5 text-center text-xs text-zinc-600">
        Built for the Appwrite Databases Hackathon · Appwrite TablesDB + Appwrite Embeddings + Appwrite Auth
      </footer>

      {(showNew || editing) && (
        <NoteModal
          key={editing?.id ?? "new"}
          initial={editing}
          subjects={subjects.map(([s]) => s)}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={(n) => {
            setShowNew(false);
            setEditing(null);
            setResults(null);
            setQuery("");
            loadNotes();
            setSelected(n.id);
          }}
        />
      )}
    </div>
  );
}

function NoteModal({ initial, subjects, onClose, onSaved }: { initial: Note | null; subjects: string[]; onClose: () => void; onSaved: (n: Note) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch(initial ? `/api/notes/${initial.id}` : "/api/notes", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, tags, content }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Could not save");
    onSaved(d.note);
  }

  const input = "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-brand/60 focus:ring-2 focus:ring-brand/20";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="glass fade-up w-full max-w-2xl rounded-2xl p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{initial ? "Edit note" : "New note"}</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. TCP three-way handshake" className={`${input} mb-3 text-base`} />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <input list="subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. Computer Networks" className={input} />
          <datalist id="subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" className={input} />
        </div>
        <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Paste or write your lecture notes…" className={`${input} scroll-thin resize-y leading-relaxed`} />
        {error && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Saved to Appwrite TablesDB with a 768-dim embedding</span>
          <button disabled={busy} className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Embedding…" : initial ? "Save changes" : "Save note"}
          </button>
        </div>
      </form>
    </div>
  );
}
