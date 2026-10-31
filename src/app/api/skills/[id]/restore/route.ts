import { authed, body } from "@/lib/http";
import { HttpError } from "@/lib/db";
import { restoreSkillVersion } from "@/lib/skills";

export const POST = authed(async ({ req, userId, params }) => {
  const version = Number((await body(req)).version);
  if (!Number.isInteger(version) || version < 1) throw new HttpError(400, "version must be a positive integer");
  const skill = await restoreSkillVersion(userId, params.id, version);
  return skill && { skill };
});
