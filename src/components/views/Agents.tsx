"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Badge, Btn, Card, Empty, ErrorNote, Field, Initials, Modal, PageHeader, Skeleton, timeAgo, useLoad } from "../ui";

export type Agent = {
  id: string; name: string; description: string; identity: string; purpose: string; systemInstructions: string; responseStyle: string;
  constraints: string; preferredClient: string; status: "active" | "inactive"; version: number; updatedAt: string;
};

export default function AgentsView() {
  const { data, error } = useLoad<{ agents: (Agent & { skillCount: number; libraryCount: number })[] }>("/api/agents");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", identity: "", systemInstructions: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api<{ agent: Agent }>("/api/agents", { body: form });
      window.location.href = `/agents/${r.agent.id}`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fade-up">
      <PageHeader title="Agents" subtitle="Saved agent setups: who the AI should be, how it should work, which skills it uses and which libraries it may read. Any connected AI can load one with get_agent_context." action={<Btn onClick={() => setOpen(true)}>+ New agent</Btn>} />
      <ErrorNote error={error} />
      {!data && !error && <Skeleton rows={3} />}
      {data && !data.agents.length && <Empty icon="◈" title="No agents yet" body="Create an agent, give it instructions, then attach published skills and the libraries it may draw on." action={<Btn onClick={() => setOpen(true)}>Create your first agent</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.agents.map((a) => (
          <Link key={a.id} href={`/agents/${a.id}`} className="block">
            <Card className={`h-full p-5 transition hover:border-pink/40 ${a.status === "inactive" ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-3">
                <Initials name={a.name} />
                <span className="font-medium text-cream">{a.name}</span>
                <Badge tone={a.status === "active" ? "green" : "zinc"}>{a.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{a.description || a.identity || "No description"}</p>
              <div className="mono-app mt-3 flex flex-wrap gap-x-4 text-zinc-500">
                <span>{a.skillCount} skills</span><span>{a.libraryCount} libraries</span>{a.preferredClient && <span>{a.preferredClient}</span>}<span className="ml-auto">edited {timeAgo(a.updatedAt)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New agent" wide>
        <form onSubmit={create}>
          <Field label="Name"><input className="input" autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Atlas reviewer" /></Field>
          <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Reviews Atlas pull requests" /></Field>
          <Field label="Identity"><input className="input" value={form.identity} onChange={(e) => setForm({ ...form, identity: e.target.value })} placeholder="A senior TypeScript reviewer who knows the Atlas codebase" /></Field>
          <Field label="Instructions" hint="You can add skills and libraries on the next screen."><textarea className="input min-h-32" value={form.systemInstructions} onChange={(e) => setForm({ ...form, systemInstructions: e.target.value })} placeholder="Be concise. Cite library passages. Flag scope creep." /></Field>
          <ErrorNote error={err} />
          <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Creating…" : "Create agent"}</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
