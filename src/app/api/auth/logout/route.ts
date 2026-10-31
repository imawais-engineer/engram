import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionClient, SESSION_COOKIE } from "@/lib/appwrite";

export async function POST() {
  try {
    const s = await createSessionClient();
    await s?.account.deleteSession({ sessionId: "current" });
  } catch {}
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
