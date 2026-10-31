import { authed, body } from "@/lib/http";
import { deleteMemory, updateMemory } from "@/lib/threads";

export const PATCH = authed(async ({ req, userId, params }) => {
  const memory = await updateMemory(userId, params.id, await body(req));
  return memory && { memory };
});
export const DELETE = authed(async ({ userId, params }) => (await deleteMemory(userId, params.id)) && { ok: true });
