import { authed, body } from "@/lib/http";
import { saveMemory } from "@/lib/threads";

export const POST = authed(async ({ req, userId, params }) => ({ memory: await saveMemory(userId, params.id, await body(req), { source: "dashboard" }) }));
