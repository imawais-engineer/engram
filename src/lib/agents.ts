import "server-only";
import { ID, Query } from "node-appwrite";
import { DATABASE_ID, T } from "./appwrite";
import { deleteWhere, getOwned, HttpError, listAll, ownerPerms, tables } from "./db";

export type Agent = {
  id: string; name: string; description: string; identity: string; purpose: string; systemInstructions: string;
  responseStyle: string; constraints: string; preferredClient: string; status: "active" | "inactive"; version: number; createdAt: string; updatedAt: string;
};
export type AgentSkillLink = { id: string; skillId: string; pinnedVersion: number | null };
export type AgentLibraryLink = { id: string; libraryId: string; access: string };
export type AgentWithLinks = Agent & { skills: AgentSkillLink[]; libraries: AgentLibraryLink[] };

type AgentRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; name: string; description?: string; identity?: string; purpose?: string; systemInstructions?: string; responseStyle?: string; constraints?: string; preferredClient?: string; status: string; version?: number };
type SkillLinkRow = { $id: string; userId: string; agentId: string; skillId: string; pinnedVersion?: number | null };
type LibLinkRow = { $id: string; userId: string; agentId: string; libraryId: string; access?: string };

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const toAgent = (r: AgentRow): Agent => ({
  id: r.$id, name: r.name, description: r.description || "", identity: r.identity || "", purpose: r.purpose || "", systemInstructions: r.systemInstructions || "",
  responseStyle: r.responseStyle || "", constraints: r.constraints || "", preferredClient: r.preferredClient || "",
  status: r.status === "inactive" ? "inactive" : "active", version: r.version || 1, createdAt: r.$createdAt, updatedAt: r.$updatedAt,
});

export type AgentInput = { name?: unknown; description?: unknown; identity?: unknown; purpose?: unknown; systemInstructions?: unknown; responseStyle?: unknown; constraints?: unknown; preferredClient?: unknown; status?: unknown };
const FIELDS: [keyof AgentInput, number][] = [["description", 4000], ["identity", 8000], ["purpose", 8000], ["systemInstructions", 50000], ["responseStyle", 4000], ["constraints", 8000], ["preferredClient", 64]];

function clean(input: AgentInput, partial: boolean) {
  const data: Record<string, unknown> = {};
  if (!partial || input.name !== undefined) { data.name = s(input.name, 120); if (!data.name) throw new HttpError(400, "Agent name is required"); }
  for (const [k, max] of FIELDS) if (!partial || input[k] !== undefined) data[k] = s(input[k], max);
  if (!partial || input.status !== undefined) {
    if (input.status !== undefined && input.status !== "active" && input.status !== "inactive") throw new HttpError(400, "status must be active or inactive");
    data.status = input.status === "inactive" ? "inactive" : "active";
  }
  return data;
}

export async function listAgents(userId: string): Promise<Agent[]> {
  return (await listAll<AgentRow>(T.agents, [Query.equal("userId", userId), Query.orderDesc("$updatedAt")])).map(toAgent);
}

export async function listAgentLinks(userId: string, agentIds: string[]) {
  if (!agentIds.length) return { skills: [] as SkillLinkRow[], libraries: [] as LibLinkRow[] };
  const [skills, libraries] = await Promise.all([
    listAll<SkillLinkRow>(T.agentSkills, [Query.equal("userId", userId), Query.equal("agentId", agentIds)]),
    listAll<LibLinkRow>(T.agentLibraries, [Query.equal("userId", userId), Query.equal("agentId", agentIds)]),
  ]);
  return { skills, libraries };
}

export async function getAgent(userId: string, id: string): Promise<AgentWithLinks | null> {
  const r = await getOwned<AgentRow>(T.agents, userId, id);
  if (!r) return null;
  const links = await listAgentLinks(userId, [id]);
  return {
    ...toAgent(r),
    skills: links.skills.map((l) => ({ id: l.$id, skillId: l.skillId, pinnedVersion: l.pinnedVersion ?? null })),
    libraries: links.libraries.map((l) => ({ id: l.$id, libraryId: l.libraryId, access: l.access || "read" })),
  };
}

export async function createAgent(userId: string, input: AgentInput & { skillIds?: unknown; libraryIds?: unknown }) {
  const row = await tables().createRow({ databaseId: DATABASE_ID, tableId: T.agents, rowId: ID.unique(), permissions: ownerPerms(userId), data: { ...clean(input, false), userId, version: 1 } });
  const id = row.$id;
  for (const sid of Array.isArray(input.skillIds) ? input.skillIds.slice(0, 50) : []) await assignSkill(userId, id, String(sid));
  for (const lid of Array.isArray(input.libraryIds) ? input.libraryIds.slice(0, 50) : []) await assignLibrary(userId, id, String(lid));
  return getAgent(userId, id);
}

export async function updateAgent(userId: string, id: string, input: AgentInput) {
  const cur = await getOwned<AgentRow>(T.agents, userId, id);
  if (!cur) return null;
  await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.agents, rowId: id, data: { ...clean(input, true), version: (cur.version || 1) + 1 } });
  return getAgent(userId, id);
}

export async function deleteAgent(userId: string, id: string) {
  if (!(await getOwned(T.agents, userId, id))) return false;
  await deleteWhere(T.agentSkills, [Query.equal("agentId", id), Query.equal("userId", userId)]);
  await deleteWhere(T.agentLibraries, [Query.equal("agentId", id), Query.equal("userId", userId)]);
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.agents, rowId: id });
  return true;
}

async function needAgent(userId: string, agentId: string) {
  if (!(await getOwned(T.agents, userId, agentId))) throw new HttpError(404, "Agent not found");
}

/** Links a skill (owned by the same user) to an agent. pinnedVersion null = always use the current published version. */
export async function assignSkill(userId: string, agentId: string, skillId: string, pinnedVersion: number | null = null) {
  await needAgent(userId, agentId);
  if (!(await getOwned(T.skills, userId, skillId))) throw new HttpError(404, "Skill not found");
  const existing = await listAll<SkillLinkRow>(T.agentSkills, [Query.equal("userId", userId), Query.equal("agentId", agentId), Query.equal("skillId", skillId)]);
  if (existing[0]) {
    await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.agentSkills, rowId: existing[0].$id, data: { pinnedVersion } });
  } else {
    await tables().createRow({ databaseId: DATABASE_ID, tableId: T.agentSkills, rowId: ID.unique(), permissions: ownerPerms(userId), data: { userId, agentId, skillId, pinnedVersion } });
  }
  return getAgent(userId, agentId);
}

export async function removeSkill(userId: string, agentId: string, skillId: string) {
  await needAgent(userId, agentId);
  await deleteWhere(T.agentSkills, [Query.equal("userId", userId), Query.equal("agentId", agentId), Query.equal("skillId", skillId)]);
  return getAgent(userId, agentId);
}

export async function assignLibrary(userId: string, agentId: string, libraryId: string) {
  await needAgent(userId, agentId);
  if (!(await getOwned(T.libraries, userId, libraryId))) throw new HttpError(404, "Library not found");
  const existing = await listAll<LibLinkRow>(T.agentLibraries, [Query.equal("userId", userId), Query.equal("agentId", agentId), Query.equal("libraryId", libraryId)]);
  if (!existing[0]) await tables().createRow({ databaseId: DATABASE_ID, tableId: T.agentLibraries, rowId: ID.unique(), permissions: ownerPerms(userId), data: { userId, agentId, libraryId, access: "read" } });
  return getAgent(userId, agentId);
}

export async function removeLibrary(userId: string, agentId: string, libraryId: string) {
  await needAgent(userId, agentId);
  await deleteWhere(T.agentLibraries, [Query.equal("userId", userId), Query.equal("agentId", agentId), Query.equal("libraryId", libraryId)]);
  return getAgent(userId, agentId);
}

/** Called when a library is deleted so no agent keeps a dangling assignment. */
export async function unlinkLibraryFromAgents(userId: string, libraryId: string) {
  return deleteWhere(T.agentLibraries, [Query.equal("userId", userId), Query.equal("libraryId", libraryId)]);
}
