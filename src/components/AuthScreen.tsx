"use client";
import { useState } from "react";
import Logo from "./Logo";
import { Initials } from "./ui";

const NAV = ["Overview", "Libraries", "Threads", "Connect"];
const anchors: Record<string, string> = { Overview: "#top", Libraries: "#features", Threads: "#how", Connect: "#clients" };

const CLIENTS = [
  { name: "Claude Code", ini: "CC", ver: "v2.1.316", what: "Remote HTTP server added with a bearer header. mcp list reports Connected." },
  { name: "MCP Inspector", ini: "MI", ver: "CLI 2.13.0", what: "Listed tools, resources and prompts; called search_library on production." },
  { name: "TypeScript SDK", ini: "TS", ver: "sdk 1.32.2", what: "All 10 tools, scopes, revocation and cross-user isolation. 71 checks." },
  { name: "Python SDK", ini: "PY", ver: "mcp 1.30.0", what: "Initialize, save_memory, get_thread_context, resources and prompts." },
];

const ROWS = [
  { k: "01 · Upload", v: "Drop PDFs, Markdown or text into a Library. Engram chunks and embeds them with Appwrite Embeddings (768-d)." },
  { k: "02 · Remember", v: "Start a Thread per project. Decisions, facts and tasks are saved as typed memories, by you or your AI." },
  { k: "03 · Connect", v: "Create a scoped Key. Your MCP client calls one endpoint, /mcp, with that bearer token." },
  { k: "04 · Audit", v: "Every tool call is logged per key. Rotate or revoke a key without touching the others." },
];

const CARDS = [
  { t: "Library", d: "Your documents, searchable by meaning.", b: ["PDF, TXT and Markdown up to 10 MB", "Semantic search with citations", "Cascade delete of chunks and files"], cta: "Add a library" },
  { t: "Thread", d: "Project memory that follows you between AI tools.", b: ["8 memory types: decisions, facts, tasks…", "Instructions every AI reads first", "Linked libraries for grounded answers"], cta: "Start a thread", hi: true },
  { t: "Key", d: "One revocable token per AI tool.", b: ["Stored as a SHA-256 hash only", "Scope to libraries and threads, set expiry", "Read-only or read + write"], cta: "Create a key" },
];

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setBusy(false);
      return;
    }
    window.location.href = "/overview";
  }
  const go = (m: "login" | "signup") => () => { setMode(m); document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <div id="top" className="flex flex-1 flex-col">
      <header className="border-b border-lilac/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <Logo size={22} />
          <nav className="order-last flex w-full gap-5 md:order-none md:w-auto">
            {NAV.map((n) => <a key={n} href={anchors[n]} className="mono text-lilac hover:text-cream">{n}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="#start" onClick={go("login")} className="mono hidden text-lilac hover:text-cream sm:inline">Sign in</a>
            <a href="#start" onClick={go("signup")} className="rounded-full bg-pink px-4 py-2 text-[12px] font-semibold text-plum hover:brightness-110">Get started</a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — the only glow on the page */}
        <section className="relative overflow-hidden">
          <div className="hero-glow" aria-hidden />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pb-20 pt-16 text-center md:pt-24">
            <div className="mono text-lilac">MCP memory layer · Built on Appwrite · Free</div>
            <h1 className="poster mt-6 max-w-[16ch] text-cream md:text-[48px]">One memory<br />for every <span className="text-pink">AI.</span></h1>
            <p className="body-s mt-6 max-w-md text-zinc-200">
              Stop re-explaining your project to every assistant. Engram keeps your documents, decisions and context in one place, and every MCP client you connect reads and writes the same memory.
            </p>
            <div className="mt-10 flex w-full max-w-3xl flex-col items-stretch gap-3 md:flex-row md:items-center">
              <div className="grid flex-1 grid-cols-3 gap-2">
                {[["10", "MCP tools"], ["768-d", "Embeddings"], ["4", "Clients tested"]].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-lilac/30 bg-plum/60 px-3 py-3 text-left">
                    <div className="font-display text-[22px] font-bold leading-none tracking-[-0.035em] text-cream md:text-[26px]">{v}</div>
                    <div className="mono mt-2 text-lilac">{l}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                <a href="#start" onClick={go("signup")} className="rounded-full bg-pink px-6 py-3.5 text-[13px] font-semibold text-plum hover:brightness-110">Create free account →</a>
                <span className="mono text-lilac">No card · bearer keys · revoke anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Works with your AI tools band */}
        <section id="clients" className="border-y border-lilac/20 bg-panel">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="poster-sm max-w-[16ch] text-cream">Works with your AI tools</h2>
              <span className="mono text-lilac">Verified against production · not a compatibility claim</span>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {CLIENTS.map((c) => (
                <div key={c.name} className="rounded-xl border border-lilac/20 bg-plum p-4">
                  <div className="flex items-center gap-3">
                    <Initials name={c.ini.split("").join(" ")} />
                    <div>
                      <div className="text-[14px] font-semibold text-cream">{c.name}</div>
                      <div className="mono text-lilac">{c.ver}</div>
                    </div>
                  </div>
                  <p className="body-s mt-3 text-zinc-300">{c.what}</p>
                  <div className="mono mt-3 inline-flex rounded-full border border-emerald-400/40 px-2 py-0.5 text-emerald-300">● Verified</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <div className="mono text-lilac">How it works</div>
              <h2 className="poster-sm mt-4 max-w-[16ch] text-cream">Three steps, one endpoint</h2>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Upload", "Remember", "Connect"].map((s, i) => (
                  <span key={s} className="mono rounded-full border border-lilac/40 px-3 py-1.5 text-cream"><span className="text-pink">0{i + 1}</span> {s}</span>
                ))}
              </div>
            </div>
            <div className="divide-y divide-lilac/20 border-y border-lilac/20">
              {ROWS.map((r) => (
                <div key={r.k} className="grid grid-cols-[110px_1fr] gap-4 py-4 md:grid-cols-[140px_1fr]">
                  <div className="mono pt-1 text-lilac">{r.k}</div>
                  <p className="body-s text-zinc-200">{r.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Library / Thread / Key */}
        <section id="features" className="mx-auto max-w-6xl px-5 pb-16">
          <div className="grid gap-3 md:grid-cols-3">
            {CARDS.map((c) => (
              <div key={c.t} className={`flex flex-col rounded-xl p-6 ${c.hi ? "order-first bg-pink text-plum md:order-none" : "border border-lilac/25 bg-panel text-cream"}`}>
                <div className={`mono ${c.hi ? "text-plum" : "text-lilac"}`}>{c.hi ? "Core · start here" : "Building block"}</div>
                <h3 className="poster-sm mt-3">{c.t}</h3>
                <p className={`body-s mt-2 ${c.hi ? "text-plum" : "text-zinc-300"}`}>{c.d}</p>
                <ul className="body-s mt-4 space-y-1.5">
                  {c.b.map((x) => <li key={x} className="flex gap-2"><span className={c.hi ? "text-plum" : "text-pink"}>—</span>{x}</li>)}
                </ul>
                <a href="#start" onClick={go("signup")} className={`mt-6 inline-flex self-start rounded-full px-4 py-2 text-[12px] font-semibold ${c.hi ? "bg-plum text-cream" : "border border-lilac/40 text-cream hover:border-lilac"}`}>{c.cta} →</a>
              </div>
            ))}
          </div>
        </section>

        {/* Free note + status + auth */}
        <section id="start" className="border-t border-lilac/20">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <div className="mono text-lilac">Pricing</div>
              <h2 className="poster-sm mt-4 max-w-[16ch] text-cream">Free to use</h2>
              <p className="body-s mt-4 max-w-md text-zinc-200">Engram runs on Appwrite Cloud&apos;s free plan: Auth, TablesDB, Storage and Embeddings. No card required. Rate limit: 60 MCP calls per minute per key.</p>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {[["MCP endpoint", "/mcp"], ["Transport", "Streamable HTTP"], ["Protocol", "2024-11 → 2025-11"], ["Auth", "Bearer eng_ keys"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-lilac/25 bg-panel p-3">
                    <div className="mono text-lilac">{k}</div>
                    <div className="mt-1.5 text-[13px] font-semibold text-cream">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="rounded-xl border border-lilac/25 bg-panel p-6 md:p-8">
              <div className="mb-6 flex rounded-lg border border-lilac/20 p-1">
                {(["signup", "login"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setMode(m)}
                    className={`mono flex-1 rounded-md py-2.5 transition ${mode === m ? "bg-violet text-cream" : "text-lilac hover:text-cream"}`}>
                    {m === "signup" ? "Create account" : "Sign in"}
                  </button>
                ))}
              </div>
              {mode === "signup" && <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />}
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" required />
              {error && <p className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <button disabled={busy} className="w-full rounded-full bg-pink py-3 text-[14px] font-semibold text-plum transition hover:brightness-110 disabled:opacity-50">
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
              <p className="mono mt-4 text-center text-lilac">Secured by Appwrite Auth · httpOnly session cookie</p>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-lilac/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <Logo size={16} />
          <span className="mono text-lilac">Keys stored as SHA-256 hashes · per-user row permissions · no OAuth</span>
          <a href="/mcp" className="mono text-lilac hover:text-cream">Endpoint · /mcp</a>
        </div>
      </footer>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="mb-4 block">
      <span className="mono mb-1.5 block text-lilac">{props.label}</span>
      <input type={props.type ?? "text"} value={props.value} required={props.required}
        minLength={props.type === "password" ? 8 : undefined} placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)} className="input py-2.5" />
    </label>
  );
}
