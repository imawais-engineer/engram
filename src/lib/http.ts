import "server-only";
import { NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getCurrentUser } from "./appwrite";
import { HttpError } from "./db";

export function errorResponse(e: unknown, fallback = "Something went wrong") {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof AppwriteException) {
    return NextResponse.json({ error: e.message }, { status: e.code >= 400 && e.code < 600 ? e.code : 500 });
  }
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : fallback }, { status: 500 });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, res: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  return { user, res: null } as const;
}

type Ctx = { params: Promise<Record<string, string>> };
/** Wraps a route handler: requires a signed-in user and maps errors to JSON responses. */
export function authed(fn: (args: { req: Request; userId: string; params: Record<string, string> }) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    const { user, res } = await requireUser();
    if (!user) return res;
    try {
      const out = await fn({ req, userId: user.$id, params: (await ctx?.params) ?? {} });
      if (out instanceof Response) return out;
      if (out === null || out === false) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(out);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export const body = async (req: Request) => {
  try { return await req.json(); } catch { return {}; }
};
