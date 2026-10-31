import { authed, body } from "@/lib/http";
import { createSkill, listSkills } from "@/lib/skills";

export const GET = authed(async ({ userId }) => ({ skills: await listSkills(userId) }));
export const POST = authed(async ({ req, userId }) => ({ skill: await createSkill(userId, await body(req)) }));
