import "server-only";
import { ID, Permission, Query, Role } from "node-appwrite";
import { createAdminClient, DATABASE_ID, NOTES_TABLE_ID } from "./appwrite";

export type Note = {
  id: string;
  title: string;
  content: string;
  subject: string;
  tags: string[];
  createdAt: string;
};
export type ScoredNote = Note & { score: number };

type Row = {
  $id: string;
  $createdAt: string;
  title: string;
  content: string;
  subject?: string | null;
  tags?: string[] | null;
  embedding?: string;
};

const MODEL = "nomic-embed-text"; // Appwrite built-in embedding model, 768 dimensions

function toNote(r: Row): Note {
  return {
    id: r.$id,
    title: r.title,
    content: r.content,
    subject: r.subject || "General",
    tags: r.tags ?? [],
    createdAt: r.$createdAt,
  };
}

/** nomic-embed-text is trained with task prefixes; using them noticeably improves retrieval. */
async function embed(texts: string[]): Promise<number[][]> {
  const { embeddings } = createAdminClient();
  const res = await embeddings.createTextEmbeddings({ texts });
  return res.embeddings.map((e) => {
    if (e.error || !e.embedding?.length) throw new Error(`Embedding failed: ${e.error || "empty vector"}`);
    return e.embedding;
  });
}

function documentText(n: Pick<Note, "title" | "subject" | "tags" | "content">) {
  const tags = n.tags.length ? ` (${n.tags.join(", ")})` : "";
  return `search_document: ${n.title}${tags}. ${n.content}`.slice(0, 8000);
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Pages through all of a user's rows (cursor pagination, 100 per page). */
async function allRows(userId: string, withEmbedding: boolean): Promise<Row[]> {
  const { tables } = createAdminClient();
  const cols = ["$id", "$createdAt", "title", "content", "subject", "tags"];
  if (withEmbedding) cols.push("embedding");
  const out: Row[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const queries = [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(100), Query.select(cols)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await tables.listRows({ databaseId: DATABASE_ID, tableId: NOTES_TABLE_ID, queries });
    out.push(...(res.rows as unknown as Row[]));
    if (res.rows.length < 100) break;
    cursor = res.rows[res.rows.length - 1].$id;
  }
  return out;
}

export async function listNotes(userId: string): Promise<Note[]> {
  return (await allRows(userId, false)).map(toNote);
}

export function normalizeTags(tags: unknown): string[] {
  const arr = Array.isArray(tags) ? tags : String(tags ?? "").split(",");
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase().replace(/^#/, "")).filter(Boolean))]
    .map((t) => t.slice(0, 32))
    .slice(0, 10);
}

export async function createNotes(
  userId: string,
  inputs: { title: string; content: string; subject?: string; tags?: unknown }[],
): Promise<Note[]> {
  const clean = inputs.map(cleanInput);
  const vectors = await embed(clean.map(documentText));
  const { tables } = createAdminClient();
  const perms = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
  const created: Note[] = [];
  for (let i = 0; i < clean.length; i++) {
    const row = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: NOTES_TABLE_ID,
      rowId: ID.unique(),
      data: { ...clean[i], userId, model: MODEL, embedding: JSON.stringify(vectors[i]) },
      permissions: perms,
    });
    created.push(toNote(row as unknown as Row));
  }
  return created;
}

export async function getNote(userId: string, id: string): Promise<(Note & { embedding: number[] }) | null> {
  const { tables } = createAdminClient();
  try {
    const row = (await tables.getRow({ databaseId: DATABASE_ID, tableId: NOTES_TABLE_ID, rowId: id })) as unknown as Row & { userId: string };
    if (row.userId !== userId) return null;
    return { ...toNote(row), embedding: JSON.parse(row.embedding || "[]") };
  } catch {
    return null;
  }
}

function cleanInput(i: { title: string; content: string; subject?: string; tags?: unknown }) {
  return {
    title: String(i.title ?? "").trim().slice(0, 200),
    content: String(i.content ?? "").trim().slice(0, 100000),
    subject: (String(i.subject ?? "").trim() || "General").slice(0, 64),
    tags: normalizeTags(i.tags),
  };
}

/** Edits a note and re-embeds it so search and related notes stay accurate. */
/** Re-embeds every note for a user (used after changing the embedding text format). */
export async function reindexUser(userId: string) {
  const rows = await allRows(userId, false);
  for (const r of rows) await updateNote(userId, r.$id, toNote(r));
  return rows.length;
}

export async function updateNote(
  userId: string,
  id: string,
  input: { title: string; content: string; subject?: string; tags?: unknown },
): Promise<Note | null> {
  const existing = await getNote(userId, id);
  if (!existing) return null;
  const clean = cleanInput(input);
  const [vector] = await embed([documentText(clean)]);
  const { tables } = createAdminClient();
  const row = await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: NOTES_TABLE_ID,
    rowId: id,
    data: { ...clean, model: MODEL, embedding: JSON.stringify(vector) },
  });
  return toNote(row as unknown as Row);
}

export async function deleteNote(userId: string, id: string) {
  const note = await getNote(userId, id);
  if (!note) return false;
  const { tables } = createAdminClient();
  await tables.deleteRow({ databaseId: DATABASE_ID, tableId: NOTES_TABLE_ID, rowId: id });
  return true;
}

function rank(rows: Row[], vector: number[], opts: { exclude?: string; subject?: string; limit: number; minScore: number; window: number }) {
  const ranked = rows
    .filter((r) => r.$id !== opts.exclude && (!opts.subject || (r.subject || "General") === opts.subject))
    .map((r) => ({ ...toNote(r), score: cosine(vector, JSON.parse(r.embedding || "[]")) }))
    .filter((n) => n.score >= opts.minScore)
    .sort((a, b) => b.score - a.score);
  // Adaptive cutoff: keep results within `window` of the best match so weak, unrelated notes drop out.
  const top = ranked[0]?.score ?? 0;
  return ranked.filter((n) => n.score >= top - opts.window).slice(0, opts.limit);
}

/** Semantic search: embed the query with Appwrite Embeddings, rank the user's notes by cosine similarity. */
export async function searchNotes(userId: string, query: string, subject?: string): Promise<ScoredNote[]> {
  const [[qv], rows] = await Promise.all([embed([`search_query: ${query.slice(0, 2000)}`]), allRows(userId, true)]);
  return rank(rows, qv, { subject, limit: 8, minScore: 0.5, window: 0.07 });
}

/** Related notes: nearest neighbours of a note's own vector. */
export async function relatedNotes(userId: string, id: string): Promise<ScoredNote[]> {
  const note = await getNote(userId, id);
  if (!note) return [];
  const rows = await allRows(userId, true);
  return rank(rows, note.embedding, { exclude: id, limit: 4, minScore: 0.5, window: 0.06 });
}
