import { authed } from "@/lib/http";
import { listActivity, listKeys } from "@/lib/keys";
import { listDocuments, listLibraries } from "@/lib/libraries";
import { listMemories, listThreads } from "@/lib/threads";

export const GET = authed(async ({ userId }) => {
  const [libraries, threads, keys, activity] = await Promise.all([listLibraries(userId), listThreads(userId), listKeys(userId), listActivity(userId, 12)]);
  const [documents, memories] = await Promise.all([listDocuments(userId, libraries.map((l) => l.id)), listMemories(userId, threads.map((t) => t.id))]);
  return {
    counts: { libraries: libraries.length, documents: documents.length, chunks: documents.reduce((s, d) => s + d.chunkCount, 0), threads: threads.length, memories: memories.length, activeKeys: keys.filter((k) => k.status === "active").length },
    recentThreads: threads.slice(0, 5).map((t) => ({ ...t, memoryCount: memories.filter((m) => m.threadId === t.id).length })),
    recentDocuments: documents.slice(0, 5),
    libraries: libraries.slice(0, 6),
    keys: keys.slice(0, 5),
    activity,
  };
});
