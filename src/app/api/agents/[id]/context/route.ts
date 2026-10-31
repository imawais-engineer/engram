import { buildAgentContext } from "@/lib/agent-context";
import { authed, body } from "@/lib/http";

// Owner preview of get_agent_context (full owner scope; MCP keys are additionally limited by their own scope).
export const POST = authed(async ({ req, userId, params }) => {
  const b = await body(req);
  return buildAgentContext(userId, null, { agentId: params.id, query: b.query ? String(b.query) : undefined, threadId: b.threadId ? String(b.threadId) : undefined, maxChars: b.maxChars ? Number(b.maxChars) : undefined });
});
