import { authed, body } from "@/lib/http";
import { createLibrary, listDocuments, listLibraries } from "@/lib/libraries";

export const GET = authed(async ({ userId }) => {
  const libraries = await listLibraries(userId);
  const docs = await listDocuments(userId, libraries.map((l) => l.id));
  return { libraries: libraries.map((l) => ({ ...l, documentCount: docs.filter((d) => d.libraryId === l.id).length, chunkCount: docs.filter((d) => d.libraryId === l.id).reduce((s, d) => s + d.chunkCount, 0) })) };
});
export const POST = authed(async ({ req, userId }) => ({ library: await createLibrary(userId, await body(req)) }));
