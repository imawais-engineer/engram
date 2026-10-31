import { authed } from "@/lib/http";
import { duplicateSkill } from "@/lib/skills";

export const POST = authed(async ({ userId, params }) => { const skill = await duplicateSkill(userId, params.id); return skill && { skill }; });
