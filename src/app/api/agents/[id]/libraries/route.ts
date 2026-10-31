import { assignLibrary, removeLibrary } from "@/lib/agents";
import { authed, body } from "@/lib/http";

export const POST = authed(async ({ req, userId, params }) => ({ agent: await assignLibrary(userId, params.id, String((await body(req)).libraryId ?? "")) }));
export const DELETE = authed(async ({ req, userId, params }) => ({ agent: await removeLibrary(userId, params.id, String((await body(req)).libraryId ?? "")) }));
