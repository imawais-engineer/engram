"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Badge, Btn, Card, ErrorNote, Field, PageHeader, Skeleton, timeAgo, useLoad } from "../ui";
import type { Skill } from "./Skills";

type Version = { id: string; version: number; name: string; instructions: string; changeSummary: string; createdAt: string };

export default function SkillView({ id }: { id: string }) {
  const { data, error, setData } = useLoad<{ skill: Skill }>(`/api/skills/${id}`);
  const [flash, setFlash] = useState("");
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton rows={4} />;
  // Remount the editor whenever the saved skill changes so the form starts from the stored values.
  return <SkillEditor key={data.skill.updatedAt} id={id} s={data.skill} flash={flash} onSkill={(skill, msg) => { setFlash(msg); setData({ skill }); }} />;
}

function SkillEditor({ id, s, flash, onSkill }: { id: string; s: Skill; flash: string; onSkill: (s: Skill, msg: string) => void }) {
  const versions = useLoad<{ versions: Version[] }>(`/api/skills/${id}/versions`);
  const [form, setForm] = useState({ name: s.name, description: s.description, category: s.category, tags: s.tags.join(", "), instructions: s.instructions, changeSummary: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(flash);
  const [peek, setPeek] = useState<Version | null>(null);

  async function run(label: string, fn: () => Promise<{ skill?: Skill }>, msg: string) {
    setBusy(label); setErr(""); setSaved("");
    try {
      const r = await fn();
      versions.reload(); setSaved(msg);
      if (r.skill) onSkill(r.skill, msg);
    } catch (e) { setErr((e as Error).message); }
    setBusy("");
  }
  const save = () => run("save", () => api(`/api/skills/${id}`, { method: "PATCH", body: { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) } }), "Saved");
  const toggle = () => run("status", () => api(`/api/skills/${id}`, { method: "PATCH", body: { status: s.status === "published" ? "draft" : "published" } }), s.status === "published" ? "Moved back to draft" : "Published");
  const restore = (v: number) => run("restore", () => api(`/api/skills/${id}/restore`, { body: { version: v } }), `Restored v${v} as a new version`);
  async function duplicate() { const r = await api<{ skill: Skill }>(`/api/skills/${id}/duplicate`, { method: "POST" }); window.location.href = `/skills/${r.skill.id}`; }
  async function remove() {
    if (!confirm(`Delete “${s.name}”, its version history and its agent assignments?`)) return;
    await api(`/api/skills/${id}`, { method: "DELETE" }); window.location.href = "/skills";
  }

  return (
    <div className="fade-up">
      <Link href="/skills" className="mono-app text-lilac hover:text-cream">← Skills</Link>
      <div className="mt-3">
        <PageHeader title={s.name} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={s.status === "published" ? "green" : "amber"}>{s.status}</Badge><span className="mono-app text-zinc-500">v{s.version} · edited {timeAgo(s.updatedAt)}</span></span>}
          action={<><Btn variant={s.status === "published" ? "outline" : "primary"} disabled={!!busy} onClick={toggle}>{s.status === "published" ? "Unpublish" : "Publish"}</Btn><Btn variant="outline" onClick={duplicate}>Duplicate</Btn><Btn variant="danger" onClick={remove}>Delete</Btn></>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 p-5">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          </div>
          <Field label="Tags" hint="Comma-separated"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <Field label="Instructions"><textarea className="input min-h-72 font-mono text-[13px] leading-relaxed" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
          <Field label="Change note" hint="Editing the name, description or instructions creates a new version."><input className="input" value={form.changeSummary} onChange={(e) => setForm({ ...form, changeSummary: e.target.value })} placeholder="What changed?" /></Field>
          <ErrorNote error={err} />
          <div className="mt-2 flex items-center justify-end gap-3">{saved && <span className="mono-app text-emerald-300">{saved}</span>}<Btn disabled={!!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</Btn></div>
        </Card>
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mono-app mb-3 text-lilac">Version history</div>
            {!versions.data && <Skeleton rows={2} />}
            <div className="space-y-2">
              {versions.data?.versions.map((v) => (
                <div key={v.id} className="rounded-lg border border-lilac/15 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-cream">v{v.version}</span>
                    {v.version === s.version && <Badge tone="violet">current</Badge>}
                    <span className="mono-app ml-auto text-zinc-500">{timeAgo(v.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{v.changeSummary || "—"}</div>
                  <div className="mt-2 flex gap-3">
                    <button onClick={() => setPeek(peek?.id === v.id ? null : v)} className="mono-app text-lilac hover:text-cream">{peek?.id === v.id ? "Hide" : "View"}</button>
                    {v.version !== s.version && <button disabled={!!busy} onClick={() => restore(v.version)} className="mono-app text-pink hover:text-cream">Restore</button>}
                  </div>
                  {peek?.id === v.id && <pre className="prose-pre mt-2 max-h-60 overflow-auto rounded-md bg-black/50 p-2 font-mono text-[12px] text-zinc-300">{v.instructions || "(empty)"}</pre>}
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4 text-sm text-zinc-400">
            <div className="mono-app mb-2 text-lilac">Use from any AI</div>
            Ask your AI: “Use the Engram skill {s.name}.” It calls <span className="font-mono text-zinc-300">get_skill</span>, or the <span className="font-mono text-zinc-300">apply_skill</span> prompt.
            <div className="mono-app mt-2 text-zinc-500">skillId: {s.id}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
