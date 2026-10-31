import "server-only";
import { NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getCurrentUser } from "./appwrite";

export function errorResponse(e: unknown, fallback = "Something went wrong") {
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
