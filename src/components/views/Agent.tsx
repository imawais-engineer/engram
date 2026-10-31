"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Badge, Btn, Card, Code, ErrorNote, Field, PageHeader, Skeleton, useLoad } from "../ui";
import type { Agent } from "./Agents";
import type { Skill } from "./Skills";

type Full = Agent & { skills: { skillId: string; pinnedVersion: number | null }[]; libraries: { libraryId: string }[] };
type Lib = { id: string; name: string; icon: string };
type Ctx = { context: string; budget: { maxChars: number; usedChars: number; truncated: boolean }; skills: { name: string; version: number }[]; skippedDraftSkills: number; citations: { documentTitle: string; chunkIndex: number }[] };

const FIELDS: [keyof Agent, string, string, boolean][] = [
  ["description", "Description", "What this agent is for", false],
  ["identity", "Identity", "Who the AI should be", false],
  ["purpose", "Purpose", "The job it does", false],
  ["systemInstructions", "Instructions", "How it should work", true],
  ["responseStyle", "Response style", "Tone, length, format", false],
  ["constraints", "Constraints", "Things it must not do", true],
  ["preferredClient", "Preferred client", "e.g. Claude Code", false],
];

export default function AgentView({ id }: { id: string }) {
  const { data, error, setData } = useLoad<{ agent: Full }>(`/api/agents/${id}`);
  const [flash, setFlash] = useState("");
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton rows={4} />;
  return <AgentEditor key={data.agent.updatedAt} a={data.agent} flash={flash} onAgent={(agent, msg) => { setFlash(msg); setData({ agent }); }} />;
}

function AgentEditor({ a, flash, onAgent }: { a: Full; flash: string; onAgent: (a: Full, msg: string) => void }) {
  const skills = useLoad<{ skills: Skill[] }>("/api/skills");
  const libs = useLoad<{ libraries: Lib[] }>("/api/libraries");
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, String(a[k] ?? "")])) as Record<string, string>);
  const [name, setName] = useState(a.name);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(flash);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState<Ctx | null>(null);

  async function run(fn: () => Promise<{ agent?: Full | null }>, msg: string) {
    setBusy(true); setErr(""); setSaved("");
    try { const r = await fn(); if (r.agent) onAgent(r.agent, msg); else setSaved(msg); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const save = () => run(() => api(`/api/agents/${a.id}`, { method: "PATCH", body: { ...form, name } }), "Saved");
  const toggle = () => run(() => api(`/api/agents/${a.id}`, { method: "PATCH", body: { status: a.status === "active" ? "inactive" : "active" } }), a.status === "active" ? "Deactivated" : "Activated");
  const link = (kind: "skills" | "libraries", body: Record<string, string>, on: boolean) => run(() => api(`/api/agents/${a.id}/${kind}`, { method: on ? "DELETE" : "POST", body }), "Updated");
  async function remove() {
    if (!confirm(`Delete agent “${a.name}”? Its skills and libraries are kept.`)) return;
    await api(`/api/agents/${a.id}`, { method: "DELETE" }); window.location.href = "/agents";
  }
  async function preview() {
    setErr("");
    try { setCtx(await api<Ctx>(`/api/agents/${a.id}/context`, { body: { query: q, maxChars: 8000 } })); } catch (e) { setErr((e as Error).message); }
  }
  const skillOn = new Set(a.skills.map((s) => s.skillId));
  const libOn = new Set(a.libraries.map((l) => l.libraryId));

  return (
    <div className="fade-up">
      <Link href="/agents" className="mono-app text-lilac hover:text-cream">← Agents</Link>
      <div className="mt-3">
        <PageHeader title={a.name} subtitle={<span className="flex items-center gap-2"><Badge tone={a.status === "active" ? "green" : "zinc"}>{a.status}</Badge><span className="mono-app text-zinc-500">config v{a.version}</span></span>}
          action={<><Btn variant="outline" disabled={busy} onClick={toggle}>{a.status === "active" ? "Deactivate" : "Activate"}</Btn><Btn variant="danger" onClick={remove}>Delete</Btn></>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5">
            <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid gap-x-4 md:grid-cols-2">
              {FIELDS.map(([k, label, ph, big]) => (
                <div key={k} className={big ? "md:col-span-2" : ""}>
                  <Field label={label}>{big ? <textarea className="input min-h-28" value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /> : <input className="input" value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}</Field>
                </div>
              ))}
            </div>
            <ErrorNote error={err} />
            <div className="mt-2 flex items-center justify-end gap-3">{saved && <span className="mono-app text-emerald-300">{saved}</span>}<Btn disabled={busy} onClick={save}>Save</Btn></div>
          </Card>
          <Card className="p-5">
            <div className="mono-app mb-2 text-lilac">Preview get_agent_context</div>
            <p className="mb-3 text-sm text-zinc-400">This is what a connected AI receives. Here it runs with your full access; through an MCP key, libraries are also limited by that key&apos;s scope.</p>
            <form onSubmit={(e) => { e.preventDefault(); preview(); }} className="flex gap-2">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Task or question, e.g. review the offline queue" />
              <Btn type="submit">Preview</Btn>
            </form>
            {ctx && (
              <div className="mt-4">
                <div className="mono-app mb-2 flex flex-wrap gap-x-4 text-zinc-500">
                  <span>{ctx.budget.usedChars}/{ctx.budget.maxChars} chars{ctx.budget.truncated ? " · truncated" : ""}</span>
                  <span>{ctx.skills.length} skills{ctx.skippedDraftSkills ? ` (+${ctx.skippedDraftSkills} draft skipped)` : ""}</span>
                  <span>{ctx.citations.length} passages</span>
                </div>
                <Code>{ctx.context}</Code>
              </div>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mono-app mb-3 text-lilac">Skills</div>
            {skills.data && !skills.data.skills.length && <p className="text-sm text-zinc-500">No skills yet. <Link href="/skills" className="text-pink">Write one</Link>.</p>}
            <div className="space-y-1.5">
              {skills.data?.skills.map((s) => {
                const on = skillOn.has(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={on} disabled={busy} onChange={() => link("skills", { skillId: s.id }, on)} className="accent-pink" />
                    <span className="truncate">{s.name}</span>
                    <Badge tone={s.status === "published" ? "green" : "amber"}>{s.status}</Badge>
                  </label>
                );
              })}
            </div>
            <p className="mono-app mt-3 text-zinc-500">Only published skills are loaded into context</p>
          </Card>
          <Card className="p-4">
            <div className="mono-app mb-3 text-lilac">Libraries it may read</div>
            {libs.data && !libs.data.libraries.length && <p className="text-sm text-zinc-500">No libraries yet.</p>}
            <div className="space-y-1.5">
              {libs.data?.libraries.map((l) => {
                const on = libOn.has(l.id);
                return (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={on} disabled={busy} onChange={() => link("libraries", { libraryId: l.id }, on)} className="accent-pink" />
                    <span className="truncate">{l.icon} {l.name}</span>
                  </label>
                );
              })}
            </div>
          </Card>
          <Card className="p-4 text-sm text-zinc-400">
            <div className="mono-app mb-2 text-lilac">Use from any AI</div>
            Ask your AI: “Load my Engram agent {a.name}.” It calls <span className="font-mono text-zinc-300">get_agent_context</span>.
            <div className="mono-app mt-2 text-zinc-500">agentId: {a.id}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
