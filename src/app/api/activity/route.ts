import { authed } from "@/lib/http";
import { listActivity } from "@/lib/keys";

export const GET = authed(async ({ req, userId }) => {
  const u = new URL(req.url);
  return { activity: await listActivity(userId, Math.min(Number(u.searchParams.get("limit")) || 30, 100), u.searchParams.get("keyId") || undefined) };
});
