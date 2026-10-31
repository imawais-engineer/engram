import { authed } from "@/lib/http";
import { deleteKey } from "@/lib/keys";

export const DELETE = authed(async ({ userId, params }) => (await deleteKey(userId, params.id)) && { ok: true });
