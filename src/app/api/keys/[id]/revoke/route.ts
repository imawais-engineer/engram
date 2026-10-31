import { authed } from "@/lib/http";
import { revokeKey } from "@/lib/keys";

export const POST = authed(async ({ userId, params }) => {
  const key = await revokeKey(userId, params.id);
  return key && { key };
});
