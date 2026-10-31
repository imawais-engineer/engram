import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { errorResponse } from "@/lib/http";
import { startSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const { users } = createAdminClient();
    await users.create({ userId: ID.unique(), email, password, name: name || undefined });
    await startSession(email, password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
