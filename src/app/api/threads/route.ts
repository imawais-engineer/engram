import { authed, body } from "@/lib/http";
import { createThread, listMemories, listThreads } from "@/lib/threads";

export const GET = authed(async ({ userId }) => {
  const threads = await listThreads(userId);
  const mems = await listMemories(userId, threads.map((t) => t.id));
  return { threads: threads.map((t) => ({ ...t, memoryCount: mems.filter((m) => m.threadId === t.id).length })) };
});
export const POST = authed(async ({ req, userId }) => ({ thread: await createThread(userId, await body(req)) }));
