import { authed } from "@/lib/http";
import { deleteDocument, getDocument } from "@/lib/libraries";

export const GET = authed(async ({ userId, params }) => {
  const document = await getDocument(userId, params.id);
  return document && { document };
});
export const DELETE = authed(async ({ userId, params }) => (await deleteDocument(userId, params.id)) && { ok: true });
