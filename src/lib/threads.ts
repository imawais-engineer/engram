import "server-only";
import { ID, Query } from "node-appwrite";
import { DATABASE_ID, T } from "./appwrite";
import { deleteWhere, getOwned, HttpError, listAll, ownerPerms, tables } from "./db";
import { asDoc, asQuery, cosine, embed, keywordScore } from "./embed";

export const MEMORY_TYPES = ["FACT", "DECISION", "PREFERENCE", "PROJECT_STATE", "TASK", "INSTRUCTION", "SUMMARY", "DOCUMENT_REFERENCE"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export type Thread = { id: string; title: string; description: string; instructions: string; summary: string; libraryIds: string[]; status: string; createdAt: string; updatedAt: string };
export type Memory = { id: string; threadId: string; type: MemoryType; content: string; tags: string[]; source: string; createdAt: string; updatedAt: string };

type ThreadRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; title: string; description?: string; instructions?: string; summary?: string; libraryIds?: string[]; status?: string };
type MemRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; threadId: string; type: MemoryType; content: string; tags?: string[]; source?: string; embedding?: string };

const toThread = (r: ThreadRow): Thread => ({
  id: r.$id, title: r.title, description: r.description || "", instructions: r.instructions || "", summary: r.summary || "",
  libraryIds: r.libraryIds || [], status: r.status || "active", createdAt: r.$createdAt, updatedAt: r.$updatedAt,
});
const toMem = (r: MemRow): Memory => ({ id: r.$id, threadId: r.threadId, type: r.type, content: r.content, tags: r.tags || [], source: r.source || "dashboard", createdAt: r.$createdAt, updatedAt: r.$updatedAt });
const MEM_COLS = ["$id", "$createdAt", "$updatedAt", "userId", "threadId", "type", "content", "tags", "source"];

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
export function normalizeTags(tags: unknown): string[] {
  const arr = Array.isArray(tags) ? tags : String(tags ?? "").split(",");
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase().replace(/^#/, "")).filter(Boolean))].map((t) => t.slice(0, 32)).slice(0, 10);
}

export async function listThreads(userId: string, onlyIds?: string[]): Promise<Thread[]> {
  if (onlyIds && !onlyIds.length) return [];
  const q = [Query.equal("userId", userId), Query.orderDesc("$updatedAt")];
  if (onlyIds) q.push(Query.equal("$id", onlyIds));
  return (await listAll<ThreadRow>(T.threads, q)).map(toThread);
}

export async function getThread(userId: string, id: string) {
  const r = await getOwned<ThreadRow>(T.threads, userId, id);
  return r ? toThread(r) : null;
}

async function ownedLibraryIds(userId: string, ids: unknown): Promise<string[]> {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, 50);
  if (!want.length) return [];
  const rows = await listAll<{ $id: string }>(T.libraries, [Query.equal("userId", userId), Query.equal("$id", want), Query.select(["$id"])]);
  return rows.map((r) => r.$id);
}

type ThreadInput = { title?: unknown; description?: unknown; instructions?: unknown; summary?: unknown; libraryIds?: unknown; status?: unknown };

export async function createThread(userId: string, input: ThreadInput) {
  const title = s(input.title, 160);
  if (!title) throw new HttpError(400, "Thread title is required");
  const row = await tables().createRow({
    databaseId: DATABASE_ID, tableId: T.threads, rowId: ID.unique(), permissions: ownerPerms(userId),
    data: { userId, title, description: s(input.description, 4000), instructions: s(input.instructions, 20000), summary: s(input.summary, 20000), libraryIds: await ownedLibraryIds(userId, input.libraryIds), status: "active" },
  });
  return toThread(row as unknown as ThreadRow);
}

export async function updateThread(userId: string, id: string, input: ThreadInput) {
  const cur = await getOwned<ThreadRow>(T.threads, userId, id);
  if (!cur) return null;
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) { data.title = s(input.title, 160); if (!data.title) throw new HttpError(400, "Thread title is required"); }
  if (input.description !== undefined) data.description = s(input.description, 4000);
  if (input.instructions !== undefined) data.instructions = s(input.instructions, 20000);
  if (input.summary !== undefined) data.summary = s(input.summary, 20000);
  if (input.libraryIds !== undefined) data.libraryIds = await ownedLibraryIds(userId, input.libraryIds);
  if (input.status !== undefined) data.status = input.status === "archived" ? "archived" : "active";
  const row = await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.threads, rowId: id, data });
  return toThread(row as unknown as ThreadRow);
}

export async function deleteThread(userId: string, id: string) {
  if (!(await getOwned(T.threads, userId, id))) return false;
  await deleteWhere(T.memories, [Query.equal("threadId", id), Query.equal("userId", userId)]);
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.threads, rowId: id });
  return true;
}

export async function listMemories(userId: string, threadIds: string[], type?: string): Promise<Memory[]> {
  if (!threadIds.length) return [];
  const q = [Query.equal("userId", userId), Query.equal("threadId", threadIds), Query.orderDesc("$createdAt"), Query.select(MEM_COLS)];
  if (type) q.push(Query.equal("type", type));
  return (await listAll<MemRow>(T.memories, q, 2000)).map(toMem);
}

function cleanMem(input: { type?: unknown; content?: unknown; tags?: unknown }) {
  const type = s(input.type, 24).toUpperCase() as MemoryType;
  if (!MEMORY_TYPES.includes(type)) throw new HttpError(400, `type must be one of ${MEMORY_TYPES.join(", ")}`);
  const content = s(input.content, 20000);
  if (!content) throw new HttpError(400, "Memory content is required");
  return { type, content, tags: normalizeTags(input.tags) };
}

const touch = (threadId: string) => tables().updateRow({ databaseId: DATABASE_ID, tableId: T.threads, rowId: threadId, data: { status: "active" } });

export async function saveMemory(userId: string, threadId: string, input: { type?: unknown; content?: unknown; tags?: unknown }, meta: { source: string; keyId?: string }) {
  if (!(await getOwned(T.threads, userId, threadId))) throw new HttpError(404, "Thread not found");
  const m = cleanMem(input);
  const [vec] = await embed([asDoc(`${m.type}: ${m.content}`)]);
  const row = await tables().createRow({
    databaseId: DATABASE_ID, tableId: T.memories, rowId: ID.unique(), permissions: ownerPerms(userId),
    data: { ...m, userId, threadId, embedding: JSON.stringify(vec), source: meta.source.slice(0, 80), keyId: meta.keyId },
  });
  await touch(threadId);
  return toMem(row as unknown as MemRow);
}

export async function getMemory(userId: string, id: string) {
  const r = await getOwned<MemRow>(T.memories, userId, id);
  return r ? toMem(r) : null;
}

export async function updateMemory(userId: string, id: string, input: { type?: unknown; content?: unknown; tags?: unknown }) {
  const cur = await getOwned<MemRow>(T.memories, userId, id);
  if (!cur) return null;
  const m = cleanMem({ type: input.type ?? cur.type, content: input.content ?? cur.content, tags: input.tags ?? cur.tags });
  const [vec] = await embed([asDoc(`${m.type}: ${m.content}`)]);
  const row = await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.memories, rowId: id, data: { ...m, embedding: JSON.stringify(vec) } });
  await touch(cur.threadId);
  return toMem(row as unknown as MemRow);
}

export async function deleteMemory(userId: string, id: string) {
  if (!(await getOwned(T.memories, userId, id))) return false;
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.memories, rowId: id });
  return true;
}

export async function searchMemories(userId: string, threadIds: string[], query: string, limit = 8) {
  if (!threadIds.length || !query.trim()) return [];
  const [[qv], rows] = await Promise.all([
    embed([asQuery(query)]),
    listAll<MemRow>(T.memories, [Query.equal("userId", userId), Query.equal("threadId", threadIds), Query.select([...MEM_COLS, "embedding"])], 5000),
  ]);
  return rows
    .map((r) => {
      const semantic = r.embedding ? cosine(qv, JSON.parse(r.embedding)) : 0;
      return { ...toMem(r), score: Math.round((semantic * 0.85 + keywordScore(query, r.content) * 0.15) * 1000) / 1000, semantic };
    })
    .filter((m) => m.semantic > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 25))
    .map(({ semantic: _s, ...m }) => m);
}
