import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/http";
import { createNotes, listNotes } from "@/lib/notes";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    return NextResponse.json({ notes: await listNotes(user.$id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const body = await req.json();
    if (!body.title?.trim() || !body.content?.trim())
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    const [note] = await createNotes(user.$id, [body]);
    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
