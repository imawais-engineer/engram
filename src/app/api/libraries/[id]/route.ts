import { authed, body } from "@/lib/http";
import { deleteLibrary, getLibrary, listDocuments, updateLibrary } from "@/lib/libraries";

export const GET = authed(async ({ userId, params }) => {
  const library = await getLibrary(userId, params.id);
  if (!library) return null;
  return { library, documents: await listDocuments(userId, [library.id]) };
});
export const PATCH = authed(async ({ req, userId, params }) => {
  const library = await updateLibrary(userId, params.id, await body(req));
  return library && { library };
});
export const DELETE = authed(async ({ userId, params }) => (await deleteLibrary(userId, params.id)) && { ok: true });
