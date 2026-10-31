import { authed, body } from "@/lib/http";
import { listLibraries, searchLibraries } from "@/lib/libraries";

export const POST = authed(async ({ req, userId }) => {
  const b = await body(req);
  const ids = Array.isArray(b.libraryIds) && b.libraryIds.length ? b.libraryIds.map(String) : (await listLibraries(userId)).map((l) => l.id);
  return { results: await searchLibraries(userId, ids, String(b.query || ""), Number(b.limit) || 8) };
});
