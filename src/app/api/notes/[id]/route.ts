import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/http";
import { deleteNote, getNote, relatedNotes, updateNote } from "@/lib/notes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const { id } = await params;
    const [note, related] = await Promise.all([getNote(user.$id, id), relatedNotes(user.$id, id)]);
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { embedding: _e, ...rest } = note;
    void _e;
    return NextResponse.json({ note: rest, related });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const { id } = await params;
    const ok = await deleteNote(user.$id, id);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { user, res } = await requireUser();
  if (!user) return res;
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.title?.trim() || !body.content?.trim())
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    const note = await updateNote(user.$id, id, body);
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ note });
  } catch (e) {
    return errorResponse(e);
  }
}
