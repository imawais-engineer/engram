import { createAgent, listAgentLinks, listAgents } from "@/lib/agents";
import { authed, body } from "@/lib/http";

export const GET = authed(async ({ userId }) => {
  const agents = await listAgents(userId);
  const links = await listAgentLinks(userId, agents.map((a) => a.id));
  return { agents: agents.map((a) => ({ ...a, skillCount: links.skills.filter((l) => l.agentId === a.id).length, libraryCount: links.libraries.filter((l) => l.agentId === a.id).length })) };
});
export const POST = authed(async ({ req, userId }) => ({ agent: await createAgent(userId, await body(req)) }));
