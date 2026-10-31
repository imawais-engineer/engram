"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Badge, Btn, Card, Empty, ErrorNote, Field, Modal, PageHeader, Skeleton, timeAgo, useLoad } from "../ui";

export type Skill = { id: string; name: string; description: string; category: string; tags: string[]; status: "draft" | "published"; version: number; instructions: string; compatibility: string; updatedAt: string };

export default function SkillsView() {
  const { data, error } = useLoad<{ skills: Skill[] }>("/api/skills");
  const [filter, setFilter] = useState<"" | "draft" | "published">("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = (data?.skills ?? []).filter((s) => !filter || s.status === filter);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api<{ skill: Skill }>("/api/skills", { body: form });
      window.location.href = `/skills/${r.skill.id}`;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fade-up">
      <PageHeader title="Skills" subtitle="Reusable instruction packs, like a code-review checklist or a writing style. Write one once, publish it, and any agent or connected AI can load it. Every edit is versioned." action={<Btn onClick={() => setOpen(true)}>+ New skill</Btn>} />
      <ErrorNote error={error} />
      {!data && !error && <Skeleton rows={3} />}
      {data && data.skills.length > 0 && (
        <div className="mb-4 flex gap-1.5">
          {(["", "published", "draft"] as const).map((f) => (
            <button key={f || "all"} onClick={() => setFilter(f)} className={`mono-app rounded-full px-3 py-1.5 ${filter === f ? "chip-active" : "text-lilac hover:text-cream"}`}>
              {f || "All"} {f ? data.skills.filter((s) => s.status === f).length : data.skills.length}
            </button>
          ))}
        </div>
      )}
      {data && !data.skills.length && <Empty icon="✦" title="No skills yet" body="A skill is a set of instructions an AI should follow for a kind of task. Drafts stay private to the dashboard; published skills are loaded into agent context." action={<Btn onClick={() => setOpen(true)}>Write your first skill</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((s) => (
          <Link key={s.id} href={`/skills/${s.id}`} className="block">
            <Card className="h-full p-5 transition hover:border-pink/40">
              <div className="flex items-center gap-2">
                <span className="font-medium text-cream">{s.name}</span>
                <Badge tone={s.status === "published" ? "green" : "amber"}>{s.status}</Badge>
                <span className="mono-app ml-auto text-zinc-500">v{s.version}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-zinc-400">{s.description || s.instructions.slice(0, 160) || "No description"}</p>
              <div className="mono-app mt-3 flex flex-wrap gap-x-3 gap-y-1 text-zinc-500">
                {s.category && <span>{s.category}</span>}
                {s.tags.map((t) => <span key={t}>#{t}</span>)}
                <span className="ml-auto">edited {timeAgo(s.updatedAt)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New skill" wide>
        <form onSubmit={create}>
          <Field label="Name"><input className="input" autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Code review checklist" /></Field>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="How I want pull requests reviewed" /></Field>
            <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="engineering" /></Field>
          </div>
          <Field label="Instructions" hint="Markdown is fine. Saved as a draft (v1); publish it from the skill page."><textarea className="input min-h-48 font-mono text-[13px]" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={"1. Run the tests first.\n2. Check auth and ownership on every new endpoint.\n3. Flag missing error handling."} /></Field>
          <ErrorNote error={err} />
          <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Creating…" : "Create draft"}</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
