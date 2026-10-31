import { authed } from "@/lib/http";
import { rotateKey } from "@/lib/keys";

export const POST = authed(async ({ userId, params }) => rotateKey(userId, params.id));
