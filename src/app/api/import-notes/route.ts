import { Query } from "node-appwrite";
import { DATABASE_ID, NOTES_TABLE_ID } from "@/lib/appwrite";
import { listAll, tables } from "@/lib/db";
import { authed } from "@/lib/http";
import { addDocument, createLibrary } from "@/lib/libraries";

export const maxDuration = 300;
type NoteRow = { $id: string; title: string; content: string; subject?: string; tags?: string[] };
const notes = (userId: string) => listAll<NoteRow>(NOTES_TABLE_ID, [Query.equal("userId", userId), Query.select(["$id", "title", "content", "subject", "tags"])]);

/** Legacy NoteMind notes: GET counts them, POST moves them into a "Notes" library as indexed documents. */
export const GET = authed(async ({ userId }) => ({ count: (await notes(userId)).length }));
export const POST = authed(async ({ userId }) => {
  const rows = await notes(userId);
  if (!rows.length) return { imported: 0 };
  const lib = await createLibrary(userId, { name: "Notes", description: "Imported from NoteMind", icon: "📝" });
  for (const n of rows) {
    const tags = n.tags?.length ? `\nTags: ${n.tags.join(", ")}` : "";
    await addDocument(userId, lib.id, { title: n.title, sourceType: "note", content: `${n.title}\nSubject: ${n.subject || "General"}${tags}\n\n${n.content}` });
    await tables().deleteRow({ databaseId: DATABASE_ID, tableId: NOTES_TABLE_ID, rowId: n.$id });
  }
  return { imported: rows.length, libraryId: lib.id };
});
