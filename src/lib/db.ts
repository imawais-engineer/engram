import "server-only";
import { Permission, Query, Role } from "node-appwrite";
import { createAdminClient, DATABASE_ID } from "./appwrite";

export const ownerPerms = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

export function tables() {
  return createAdminClient().tables;
}

/** Cursor-paginates every row matching `queries` (100 per page, capped at `max`). */
export async function listAll<R>(tableId: string, queries: string[], max = 5000): Promise<R[]> {
  const t = tables();
  const out: R[] = [];
  let cursor: string | undefined;
  while (out.length < max) {
    const q = [...queries, Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await t.listRows({ databaseId: DATABASE_ID, tableId, queries: q });
    out.push(...(res.rows as unknown as R[]));
    if (res.rows.length < 100) break;
    cursor = res.rows[res.rows.length - 1].$id;
  }
  return out;
}

export async function getOwned<R extends { userId: string }>(tableId: string, userId: string, id: string): Promise<R | null> {
  if (!id || !/^[a-zA-Z0-9._-]{1,36}$/.test(id)) return null;
  try {
    const row = (await tables().getRow({ databaseId: DATABASE_ID, tableId, rowId: id })) as unknown as R;
    return row.userId === userId ? row : null;
  } catch {
    return null;
  }
}

export async function countRows(tableId: string, queries: string[]) {
  const res = await tables().listRows({ databaseId: DATABASE_ID, tableId, queries: [...queries, Query.limit(1), Query.select(["$id"])] });
  return res.total;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bulk-deletes every row matching `queries`, looping because bulk deletes are capped per request. */
export async function deleteWhere(tableId: string, queries: string[]) {
  let removed = 0;
  for (let i = 0; i < 100; i++) {
    const r = await tables().deleteRows({ databaseId: DATABASE_ID, tableId, queries });
    removed += r.total;
    if (!r.total) break;
  }
  return removed;
}
