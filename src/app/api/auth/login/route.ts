import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { startSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    await startSession(email, password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
