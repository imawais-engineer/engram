import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ID, Query } from "node-appwrite";
import { DATABASE_ID, T } from "./appwrite";
import { getOwned, HttpError, listAll, ownerPerms, tables } from "./db";

export type KeyScope = { allLibraries: boolean; libraryIds: string[]; allThreads: boolean; threadIds: string[]; canWrite: boolean };
export type ApiKey = KeyScope & { id: string; name: string; prefix: string; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null; createdAt: string; status: "active" | "expired" | "revoked" };
export type AuthedKey = ApiKey & { userId: string };

type KeyRow = {
  $id: string; $createdAt: string; userId: string; name: string; tokenHash: string; prefix: string; allLibraries?: boolean; allThreads?: boolean; canWrite?: boolean;
  libraryIds?: string[]; threadIds?: string[]; expiresAt?: string | null; revokedAt?: string | null; lastUsedAt?: string | null;
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function status(r: KeyRow): ApiKey["status"] {
  if (r.revokedAt) return "revoked";
  if (r.expiresAt && new Date(r.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}
const toKey = (r: KeyRow): ApiKey => ({
  id: r.$id, name: r.name, prefix: r.prefix, allLibraries: !!r.allLibraries, libraryIds: r.libraryIds || [], allThreads: !!r.allThreads, threadIds: r.threadIds || [],
  canWrite: r.canWrite !== false, expiresAt: r.expiresAt || null, revokedAt: r.revokedAt || null, lastUsedAt: r.lastUsedAt || null, createdAt: r.$createdAt, status: status(r),
});

export async function listKeys(userId: string) {
  return (await listAll<KeyRow>(T.keys, [Query.equal("userId", userId), Query.orderDesc("$createdAt")])).map(toKey);
}

async function ownedIds(tableId: string, userId: string, ids: unknown) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, 100);
  if (!want.length) return [];
  return (await listAll<{ $id: string }>(tableId, [Query.equal("userId", userId), Query.equal("$id", want), Query.select(["$id"])])).map((r) => r.$id);
}

export type KeyInput = { name?: unknown; allLibraries?: unknown; libraryIds?: unknown; allThreads?: unknown; threadIds?: unknown; canWrite?: unknown; expiresInDays?: unknown };

/** Creates a key. The plaintext token is returned exactly once; only its SHA-256 hash is stored. */
export async function createKey(userId: string, input: KeyInput): Promise<{ key: ApiKey; token: string }> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new HttpError(400, "Key name is required");
  const days = Number(input.expiresInDays ?? 30);
  const expiresAt = days > 0 ? new Date(Date.now() + Math.min(days, 365) * 86400_000).toISOString() : null;
  const token = `eng_${randomBytes(24).toString("base64url")}`;
  const scope = {
    allLibraries: input.allLibraries === true,
    allThreads: input.allThreads === true,
    canWrite: input.canWrite !== false,
    libraryIds: input.allLibraries === true ? [] : await ownedIds(T.libraries, userId, input.libraryIds),
    threadIds: input.allThreads === true ? [] : await ownedIds(T.threads, userId, input.threadIds),
  };
  const row = await tables().createRow({
    databaseId: DATABASE_ID, tableId: T.keys, rowId: ID.unique(), permissions: ownerPerms(userId),
    data: { userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 12), expiresAt, ...scope },
  });
  await logActivity(userId, { keyId: row.$id, keyName: name, action: "key.created", detail: "Created in dashboard" });
  return { key: toKey(row as unknown as KeyRow), token };
}

export async function revokeKey(userId: string, id: string) {
  const r = await getOwned<KeyRow>(T.keys, userId, id);
  if (!r) return null;
  const row = await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.keys, rowId: id, data: { revokedAt: r.revokedAt || new Date().toISOString() } });
  await logActivity(userId, { keyId: id, keyName: r.name, action: "key.revoked", detail: "Revoked in dashboard" });
  return toKey(row as unknown as KeyRow);
}

/** Rotation = revoke the old key and issue a new one with the same name, scope and lifetime. */
export async function rotateKey(userId: string, id: string) {
  const r = await getOwned<KeyRow>(T.keys, userId, id);
  if (!r) return null;
  const old = toKey(r);
  const lifetimeDays = old.expiresAt ? Math.max(1, Math.round((new Date(old.expiresAt).getTime() - new Date(old.createdAt).getTime()) / 86400_000)) : 0;
  await revokeKey(userId, id);
  return createKey(userId, { ...old, expiresInDays: lifetimeDays });
}

export async function deleteKey(userId: string, id: string) {
  if (!(await getOwned(T.keys, userId, id))) return false;
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.keys, rowId: id });
  return true;
}

/** Resolves a bearer token to its key, rejecting unknown, revoked and expired keys. */
export async function authenticateToken(token: string): Promise<AuthedKey | null> {
  if (!/^eng_[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const res = await tables().listRows({ databaseId: DATABASE_ID, tableId: T.keys, queries: [Query.equal("tokenHash", hashToken(token)), Query.limit(1)] });
  const r = res.rows[0] as unknown as KeyRow | undefined;
  if (!r) return null;
  const k = toKey(r);
  if (k.status !== "active") return null;
  // Best-effort: don't block the request on bookkeeping.
  tables().updateRow({ databaseId: DATABASE_ID, tableId: T.keys, rowId: r.$id, data: { lastUsedAt: new Date().toISOString() } }).catch(() => {});
  return { ...k, userId: r.userId };
}

export async function logActivity(userId: string, a: { keyId?: string; keyName?: string; action: string; detail?: string; status?: string }) {
  try {
    await tables().createRow({
      databaseId: DATABASE_ID, tableId: T.activity, rowId: ID.unique(), permissions: ownerPerms(userId),
      data: { userId, keyId: a.keyId, keyName: a.keyName?.slice(0, 80), action: a.action.slice(0, 48), detail: a.detail?.slice(0, 255), status: a.status || "ok" },
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

export type Activity = { id: string; keyId: string; keyName: string; action: string; detail: string; status: string; createdAt: string };
export async function listActivity(userId: string, limit = 30, keyId?: string): Promise<Activity[]> {
  const q = [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(limit)];
  if (keyId) q.push(Query.equal("keyId", keyId));
  const res = await tables().listRows({ databaseId: DATABASE_ID, tableId: T.activity, queries: q });
  return (res.rows as unknown as (Activity & { $id: string; $createdAt: string })[]).map((r) => ({
    id: r.$id, keyId: r.keyId || "", keyName: r.keyName || "", action: r.action, detail: r.detail || "", status: r.status || "ok", createdAt: r.$createdAt,
  }));
}

// Fixed-window rate limit per key, per server instance (60 requests/minute).
const windows = new Map<string, { start: number; count: number }>();
export function rateLimit(id: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const w = windows.get(id);
  if (!w || now - w.start > windowMs) { windows.set(id, { start: now, count: 1 }); return { ok: true, retryAfter: 0 }; }
  w.count++;
  return w.count > limit ? { ok: false, retryAfter: Math.ceil((w.start + windowMs - now) / 1000) } : { ok: true, retryAfter: 0 };
}

export function canLibrary(k: KeyScope, libraryId: string) {
  return k.allLibraries || k.libraryIds.includes(libraryId);
}
export function canThread(k: KeyScope, threadId: string) {
  return k.allThreads || k.threadIds.includes(threadId);
}
