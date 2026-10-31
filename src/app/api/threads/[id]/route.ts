import { authed, body } from "@/lib/http";
import { deleteThread, getThread, listMemories, updateThread } from "@/lib/threads";

export const GET = authed(async ({ userId, params }) => {
  const thread = await getThread(userId, params.id);
  return thread && { thread, memories: await listMemories(userId, [thread.id]) };
});
export const PATCH = authed(async ({ req, userId, params }) => {
  const thread = await updateThread(userId, params.id, await body(req));
  return thread && { thread };
});
export const DELETE = authed(async ({ userId, params }) => (await deleteThread(userId, params.id)) && { ok: true });
