import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/http";
import { createNotes } from "@/lib/notes";
import { SAMPLE_NOTES } from "@/lib/sample-notes";

export async function POST() {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const notes = await createNotes(user.$id, SAMPLE_NOTES);
    return NextResponse.json({ created: notes.length });
  } catch (e) {
    return errorResponse(e);
  }
}
