"use client";
import { useState } from "react";
import Logo from "./Logo";

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

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-5xl items-center gap-12 md:grid-cols-2">
        <section className="fade-up">
          <Logo size={36} />
          <h1 className="mt-8 text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            One memory for <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">every AI</span>.
          </h1>
          <p className="mt-5 max-w-md text-zinc-400">
            Stop re-explaining your project to every assistant. Engram keeps your documents, decisions and project context in one place,
            and MCP clients you connect can read and add to it through one secure endpoint.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-zinc-300">
            {[
              "Libraries: PDFs, Markdown and notes, chunked and embedded with Appwrite Embeddings",
              "Threads: typed memories (decisions, facts, tasks) that carry across your AI tools",
              "Keys: scoped, revocable MCP bearer tokens, with every tool call logged",
              "Tested with Claude Code, MCP Inspector and the TypeScript and Python MCP SDKs",
              "Built on Appwrite Auth, TablesDB and Storage",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-2" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={submit} className="glass fade-up rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 flex rounded-lg bg-zinc-900 p-1 text-sm">
            {(["signup", "login"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-2 transition ${mode === m ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" required />
          {error && <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 py-2.5 font-medium text-white shadow-lg shadow-brand/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-xs text-zinc-500">Secured by Appwrite Auth · session in an httpOnly cookie</p>
        </form>
      </div>
    </main>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        required={props.required}
        minLength={props.type === "password" ? 8 : undefined}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
