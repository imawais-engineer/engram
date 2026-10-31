import { deleteAgent, getAgent, updateAgent } from "@/lib/agents";
import { authed, body } from "@/lib/http";

export const GET = authed(async ({ userId, params }) => { const agent = await getAgent(userId, params.id); return agent && { agent }; });
export const PATCH = authed(async ({ req, userId, params }) => { const agent = await updateAgent(userId, params.id, await body(req)); return agent && { agent }; });
export const DELETE = authed(async ({ userId, params }) => (await deleteAgent(userId, params.id)) && { ok: true });
