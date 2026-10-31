import { authed, body } from "@/lib/http";
import { deleteSkill, getSkill, updateSkill } from "@/lib/skills";

export const GET = authed(async ({ userId, params }) => { const skill = await getSkill(userId, params.id); return skill && { skill }; });
export const PATCH = authed(async ({ req, userId, params }) => { const skill = await updateSkill(userId, params.id, await body(req)); return skill && { skill }; });
export const DELETE = authed(async ({ userId, params }) => (await deleteSkill(userId, params.id)) && { ok: true });
