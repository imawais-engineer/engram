import { authed } from "@/lib/http";
import { listSkillVersions } from "@/lib/skills";

export const GET = authed(async ({ userId, params }) => { const versions = await listSkillVersions(userId, params.id); return versions && { versions }; });
