import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/http";
import { searchNotes } from "@/lib/notes";

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const subject = url.searchParams.get("subject") || undefined;
    if (!q) return NextResponse.json({ results: [] });
    const t = Date.now();
    const results = await searchNotes(user.$id, q, subject);
    return NextResponse.json({ results, ms: Date.now() - t });
  } catch (e) {
    return errorResponse(e);
  }
}
