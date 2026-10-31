import { authed } from "@/lib/http";
import { listActivity, listKeys } from "@/lib/keys";
import { listDocuments, listLibraries } from "@/lib/libraries";
import { listMemories, listThreads } from "@/lib/threads";
import { listSkills } from "@/lib/skills";
import { listAgents } from "@/lib/agents";

export const GET = authed(async ({ userId }) => {
  const [libraries, threads, keys, activity, skills, agents] = await Promise.all([listLibraries(userId), listThreads(userId), listKeys(userId), listActivity(userId, 12), listSkills(userId), listAgents(userId)]);
  const [documents, memories] = await Promise.all([listDocuments(userId, libraries.map((l) => l.id)), listMemories(userId, threads.map((t) => t.id))]);
  return {
    counts: { libraries: libraries.length, documents: documents.length, chunks: documents.reduce((s, d) => s + d.chunkCount, 0), threads: threads.length, memories: memories.length, activeKeys: keys.filter((k) => k.status === "active").length, skills: skills.length, publishedSkills: skills.filter((x) => x.status === "published").length, agents: agents.length, activeAgents: agents.filter((a) => a.status === "active").length },
    recentThreads: threads.slice(0, 5).map((t) => ({ ...t, memoryCount: memories.filter((m) => m.threadId === t.id).length })),
    recentDocuments: documents.slice(0, 5),
    libraries: libraries.slice(0, 6),
    keys: keys.slice(0, 5),
    activity,
  };
});
