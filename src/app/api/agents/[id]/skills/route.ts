import { assignSkill, removeSkill } from "@/lib/agents";
import { authed, body } from "@/lib/http";

export const POST = authed(async ({ req, userId, params }) => {
  const b = await body(req);
  const pin = b.pinnedVersion ? Number(b.pinnedVersion) : null;
  return { agent: await assignSkill(userId, params.id, String(b.skillId ?? ""), Number.isInteger(pin) && pin! > 0 ? pin : null) };
});
export const DELETE = authed(async ({ req, userId, params }) => ({ agent: await removeSkill(userId, params.id, String((await body(req)).skillId ?? "")) }));
