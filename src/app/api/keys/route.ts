import { authed, body } from "@/lib/http";
import { createKey, listKeys } from "@/lib/keys";

export const GET = authed(async ({ userId }) => ({ keys: await listKeys(userId) }));
export const POST = authed(async ({ req, userId }) => createKey(userId, await body(req)));
