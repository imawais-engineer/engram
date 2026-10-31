import "server-only";
import { ID, Query } from "node-appwrite";
import { DATABASE_ID, T } from "./appwrite";
import { deleteWhere, getOwned, HttpError, listAll, ownerPerms, tables } from "./db";
import { normalizeTags } from "./threads";

export const SKILL_STATUSES = ["draft", "published"] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];
export type Skill = {
  id: string; name: string; description: string; category: string; tags: string[]; status: SkillStatus;
  version: number; instructions: string; compatibility: string; createdAt: string; updatedAt: string;
};
export type SkillVersion = { id: string; skillId: string; version: number; name: string; description: string; instructions: string; changeSummary: string; createdAt: string };

type SkillRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; name: string; description?: string; category?: string; tags?: string[]; status: string; currentVersion?: number; instructions?: string; compatibility?: string };
type VersionRow = { $id: string; $createdAt: string; userId: string; skillId: string; version: number; name?: string; description?: string; instructions?: string; changeSummary?: string };

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const toSkill = (r: SkillRow): Skill => ({
  id: r.$id, name: r.name, description: r.description || "", category: r.category || "", tags: r.tags || [],
  status: r.status === "published" ? "published" : "draft", version: r.currentVersion || 1, instructions: r.instructions || "",
  compatibility: r.compatibility || "", createdAt: r.$createdAt, updatedAt: r.$updatedAt,
});
const toVersion = (r: VersionRow): SkillVersion => ({
  id: r.$id, skillId: r.skillId, version: r.version, name: r.name || "", description: r.description || "", instructions: r.instructions || "", changeSummary: r.changeSummary || "", createdAt: r.$createdAt,
});

export type SkillInput = { name?: unknown; description?: unknown; category?: unknown; tags?: unknown; status?: unknown; instructions?: unknown; compatibility?: unknown; changeSummary?: unknown };

const MAX_INSTRUCTIONS = 50_000;

export async function listSkills(userId: string, opts: { status?: SkillStatus; ids?: string[] } = {}): Promise<Skill[]> {
  if (opts.ids && !opts.ids.length) return [];
  const q = [Query.equal("userId", userId), Query.orderDesc("$updatedAt")];
  if (opts.status) q.push(Query.equal("status", opts.status));
  if (opts.ids) q.push(Query.equal("$id", opts.ids.slice(0, 100)));
  return (await listAll<SkillRow>(T.skills, q)).map(toSkill);
}

export async function getSkill(userId: string, id: string) {
  const r = await getOwned<SkillRow>(T.skills, userId, id);
  return r ? toSkill(r) : null;
}

async function writeVersion(userId: string, skill: { id: string; name: string; description: string; instructions: string }, version: number, changeSummary: string) {
  await tables().createRow({
    databaseId: DATABASE_ID, tableId: T.skillVersions, rowId: ID.unique(), permissions: ownerPerms(userId),
    data: { userId, skillId: skill.id, version, name: skill.name, description: skill.description, instructions: skill.instructions, changeSummary: s(changeSummary, 255) },
  });
}

export async function createSkill(userId: string, input: SkillInput) {
  const name = s(input.name, 120);
  if (!name) throw new HttpError(400, "Skill name is required");
  const data = {
    userId, name, description: s(input.description, 4000), category: s(input.category, 48), tags: normalizeTags(input.tags),
    status: input.status === "published" ? "published" : "draft", currentVersion: 1, instructions: s(input.instructions, MAX_INSTRUCTIONS), compatibility: s(input.compatibility, 2000),
  };
  const row = await tables().createRow({ databaseId: DATABASE_ID, tableId: T.skills, rowId: ID.unique(), permissions: ownerPerms(userId), data });
  const skill = toSkill(row as unknown as SkillRow);
  await writeVersion(userId, skill, 1, s(input.changeSummary, 255) || "Created");
  return skill;
}

/** Content edits (name, description, instructions) create a new version; metadata edits (status, tags, category) don't. */
export async function updateSkill(userId: string, id: string, input: SkillInput) {
  const cur = await getOwned<SkillRow>(T.skills, userId, id);
  if (!cur) return null;
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) { data.name = s(input.name, 120); if (!data.name) throw new HttpError(400, "Skill name is required"); }
  if (input.description !== undefined) data.description = s(input.description, 4000);
  if (input.instructions !== undefined) data.instructions = s(input.instructions, MAX_INSTRUCTIONS);
  if (input.category !== undefined) data.category = s(input.category, 48);
  if (input.tags !== undefined) data.tags = normalizeTags(input.tags);
  if (input.compatibility !== undefined) data.compatibility = s(input.compatibility, 2000);
  if (input.status !== undefined) {
    if (!SKILL_STATUSES.includes(input.status as SkillStatus)) throw new HttpError(400, "status must be draft or published");
    data.status = input.status;
  }
  const contentChanged = (["name", "description", "instructions"] as const).some((k) => data[k] !== undefined && data[k] !== (cur[k] || ""));
  if (contentChanged) data.currentVersion = (cur.currentVersion || 1) + 1;
  const row = await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.skills, rowId: id, data });
  const skill = toSkill(row as unknown as SkillRow);
  if (contentChanged) await writeVersion(userId, skill, skill.version, s(input.changeSummary, 255) || "Edited");
  return skill;
}

export async function listSkillVersions(userId: string, skillId: string) {
  if (!(await getOwned(T.skills, userId, skillId))) return null;
  return (await listAll<VersionRow>(T.skillVersions, [Query.equal("userId", userId), Query.equal("skillId", skillId), Query.orderDesc("version")])).map(toVersion);
}

export async function getSkillVersion(userId: string, skillId: string, version: number) {
  const res = await tables().listRows({ databaseId: DATABASE_ID, tableId: T.skillVersions, queries: [Query.equal("userId", userId), Query.equal("skillId", skillId), Query.equal("version", version), Query.limit(1)] });
  const r = res.rows[0] as unknown as VersionRow | undefined;
  return r ? toVersion(r) : null;
}

/** Restoring copies an old version's content forward as a new version, so history is never rewritten. */
export async function restoreSkillVersion(userId: string, skillId: string, version: number) {
  if (!(await getOwned(T.skills, userId, skillId))) return null;
  const v = await getSkillVersion(userId, skillId, version);
  if (!v) throw new HttpError(404, `Version ${version} not found`);
  return updateSkill(userId, skillId, { name: v.name, description: v.description, instructions: v.instructions, changeSummary: `Restored v${version}` });
}

export async function duplicateSkill(userId: string, id: string) {
  const cur = await getSkill(userId, id);
  if (!cur) return null;
  return createSkill(userId, { ...cur, name: `${cur.name} (copy)`.slice(0, 120), status: "draft", changeSummary: `Duplicated from ${cur.name} v${cur.version}` });
}

/** Deletes a skill, its versions and every agent assignment that points at it. */
export async function deleteSkill(userId: string, id: string) {
  if (!(await getOwned(T.skills, userId, id))) return false;
  await deleteWhere(T.skillVersions, [Query.equal("skillId", id), Query.equal("userId", userId)]);
  await deleteWhere(T.agentSkills, [Query.equal("skillId", id), Query.equal("userId", userId)]);
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.skills, rowId: id });
  return true;
}
