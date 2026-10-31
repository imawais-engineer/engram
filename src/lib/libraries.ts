import "server-only";
import { unlinkLibraryFromAgents } from "./agents";
import { ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { BUCKET_ID, createAdminClient, DATABASE_ID, T } from "./appwrite";
import { getOwned, HttpError, listAll, ownerPerms, tables } from "./db";
import { asDoc, asQuery, embed } from "./embed";
import { vectorStore } from "./vector-store";

export type Library = { id: string; name: string; description: string; icon: string; createdAt: string; updatedAt: string };
export type DocStatus = "uploaded" | "processing" | "indexed" | "failed";
export type Doc = {
  id: string; libraryId: string; title: string; sourceType: string; mimeType: string; size: number;
  status: DocStatus; error: string; chunkCount: number; createdAt: string; updatedAt: string;
};

type LibRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; name: string; description?: string; icon?: string; archived?: boolean };
type DocRow = { $id: string; $createdAt: string; $updatedAt: string; userId: string; libraryId: string; title: string; sourceType: string; mimeType?: string; fileId?: string; size?: number; status: DocStatus; error?: string; chunkCount?: number; content?: string };

const toLib = (r: LibRow): Library => ({ id: r.$id, name: r.name, description: r.description || "", icon: r.icon || "📚", createdAt: r.$createdAt, updatedAt: r.$updatedAt });
const toDoc = (r: DocRow): Doc => ({
  id: r.$id, libraryId: r.libraryId, title: r.title, sourceType: r.sourceType, mimeType: r.mimeType || "", size: r.size || 0,
  status: r.status, error: r.error || "", chunkCount: r.chunkCount || 0, createdAt: r.$createdAt, updatedAt: r.$updatedAt,
});
const DOC_COLS = ["$id", "$createdAt", "$updatedAt", "userId", "libraryId", "title", "sourceType", "mimeType", "fileId", "size", "status", "error", "chunkCount"];

export async function listLibraries(userId: string, onlyIds?: string[]): Promise<Library[]> {
  if (onlyIds && !onlyIds.length) return [];
  const q = [Query.equal("userId", userId), Query.orderDesc("$createdAt")];
  if (onlyIds) q.push(Query.equal("$id", onlyIds));
  return (await listAll<LibRow>(T.libraries, q)).map(toLib);
}

export async function getLibrary(userId: string, id: string) {
  const r = await getOwned<LibRow>(T.libraries, userId, id);
  return r ? toLib(r) : null;
}

function cleanLib(input: { name?: unknown; description?: unknown; icon?: unknown }) {
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Library name is required");
  return { name, description: String(input.description ?? "").trim().slice(0, 2000), icon: String(input.icon ?? "📚").trim().slice(0, 8) || "📚" };
}

export async function createLibrary(userId: string, input: { name?: unknown; description?: unknown; icon?: unknown }) {
  const row = await tables().createRow({ databaseId: DATABASE_ID, tableId: T.libraries, rowId: ID.unique(), data: { ...cleanLib(input), userId }, permissions: ownerPerms(userId) });
  return toLib(row as unknown as LibRow);
}

export async function updateLibrary(userId: string, id: string, input: { name?: unknown; description?: unknown; icon?: unknown }) {
  if (!(await getOwned(T.libraries, userId, id))) return null;
  const row = await tables().updateRow({ databaseId: DATABASE_ID, tableId: T.libraries, rowId: id, data: cleanLib(input) });
  return toLib(row as unknown as LibRow);
}

export async function deleteLibrary(userId: string, id: string) {
  if (!(await getOwned(T.libraries, userId, id))) return false;
  const docs = await listAll<DocRow>(T.documents, [Query.equal("libraryId", id), Query.equal("userId", userId), Query.select(["$id"])]);
  for (const d of docs) await deleteDocument(userId, d.$id);
  await unlinkLibraryFromAgents(userId, id);
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.libraries, rowId: id });
  return true;
}

export async function listDocuments(userId: string, libraryIds: string[]): Promise<Doc[]> {
  if (!libraryIds.length) return [];
  const rows = await listAll<DocRow>(T.documents, [Query.equal("userId", userId), Query.equal("libraryId", libraryIds), Query.orderDesc("$createdAt"), Query.select(DOC_COLS)]);
  return rows.map(toDoc);
}

export async function getDocument(userId: string, id: string): Promise<(Doc & { content: string }) | null> {
  const r = await getOwned<DocRow>(T.documents, userId, id);
  return r ? { ...toDoc(r), content: r.content || "" } : null;
}

export async function deleteDocument(userId: string, id: string) {
  const r = await getOwned<DocRow>(T.documents, userId, id);
  if (!r) return false;
  await vectorStore.deleteByDocument(userId, id);
  if (r.fileId) {
    try { await createAdminClient().storage.deleteFile({ bucketId: BUCKET_ID, fileId: r.fileId }); } catch { /* already gone */ }
  }
  await tables().deleteRow({ databaseId: DATABASE_ID, tableId: T.documents, rowId: id });
  return true;
}

/** ~900-char chunks with 150-char overlap, preferring paragraph/sentence boundaries. */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start + Math.floor(size * 0.5), end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (cut > 0) end = start + Math.floor(size * 0.5) + cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export async function extractText(name: string, mime: string, buf: Buffer): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: false });
    return (text as string[]).map((p, i) => `[page ${i + 1}]\n${p}`).join("\n\n");
  }
  if (/\.(txt|md|markdown)$/.test(lower) || mime.startsWith("text/")) return buf.toString("utf8");
  throw new HttpError(415, "Only PDF, TXT and Markdown files are supported");
}

type NewDoc = { title: string; sourceType: "upload" | "text" | "note"; content?: string; file?: { name: string; mime: string; buf: Buffer } };

/** Creates the document row, stores the original file in Appwrite Storage, extracts, chunks, embeds and indexes it. */
export async function addDocument(userId: string, libraryId: string, input: NewDoc): Promise<Doc> {
  if (!(await getOwned(T.libraries, userId, libraryId))) throw new HttpError(404, "Library not found");
  const t = tables();
  const title = (input.title || input.file?.name || "Untitled").trim().slice(0, 255);
  let fileId: string | undefined;
  if (input.file) {
    if (input.file.buf.length > 10 * 1024 * 1024) throw new HttpError(413, "Files must be 10 MB or smaller");
    const f = await createAdminClient().storage.createFile({
      bucketId: BUCKET_ID, fileId: ID.unique(), file: InputFile.fromBuffer(input.file.buf, input.file.name), permissions: ownerPerms(userId),
    });
    fileId = f.$id;
  }
  const row = (await t.createRow({
    databaseId: DATABASE_ID, tableId: T.documents, rowId: ID.unique(), permissions: ownerPerms(userId),
    data: { userId, libraryId, title, sourceType: input.sourceType, mimeType: input.file?.mime || "text/plain", fileId, size: input.file?.buf.length ?? (input.content || "").length, status: input.file ? "uploaded" : "processing", chunkCount: 0 },
  })) as unknown as DocRow;
  return indexDocument(userId, row.$id, input);
}

async function indexDocument(userId: string, docId: string, input: NewDoc): Promise<Doc> {
  const t = tables();
  const set = async (data: Record<string, unknown>) => toDoc((await t.updateRow({ databaseId: DATABASE_ID, tableId: T.documents, rowId: docId, data })) as unknown as DocRow);
  try {
    await set({ status: "processing" });
    const text = input.file ? await extractText(input.file.name, input.file.mime, input.file.buf) : String(input.content || "");
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("No readable text found in this document");
    if (chunks.length > 400) throw new Error("Document is too large for the hackathon demo (over 400 chunks)");
    const title = (input.title || input.file?.name || "").slice(0, 120);
    const vectors = await embed(chunks.map((c) => asDoc(`${title}. ${c}`)));
    const row = await getOwned<DocRow>(T.documents, userId, docId);
    if (!row) throw new Error("Document disappeared");
    await vectorStore.upsert(chunks.map((c, i) => ({ userId, libraryId: row.libraryId, documentId: docId, index: i, text: c, vector: vectors[i] })));
    return await set({ status: "indexed", chunkCount: chunks.length, content: text.slice(0, 1_000_000), error: null });
  } catch (e) {
    return await set({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
  }
}

export type SearchHit = { documentId: string; documentTitle: string; libraryId: string; libraryName: string; chunkIndex: number; text: string; score: number };

/** Semantic + keyword search across libraries, returning chunk-level citations. */
export async function searchLibraries(userId: string, libraryIds: string[], query: string, limit = 6): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q || !libraryIds.length) return [];
  const [[vector], libs] = await Promise.all([embed([asQuery(q)]), listLibraries(userId, libraryIds)]);
  const allowed = libs.map((l) => l.id);
  const hits = await vectorStore.search({ userId, libraryIds: allowed, vector, query: q, limit: Math.min(Math.max(limit, 1), 20) });
  const docIds = [...new Set(hits.map((h) => h.documentId))];
  const docs = docIds.length ? await listAll<DocRow>(T.documents, [Query.equal("$id", docIds), Query.select(["$id", "title"])]) : [];
  const title = new Map(docs.map((d) => [d.$id, d.title]));
  const libName = new Map(libs.map((l) => [l.id, l.name]));
  return hits.filter((h) => h.semantic > 0.45).map((h) => ({
    documentId: h.documentId, documentTitle: title.get(h.documentId) || "Untitled", libraryId: h.libraryId, libraryName: libName.get(h.libraryId) || "",
    chunkIndex: h.index, text: h.text, score: Math.round(h.score * 1000) / 1000,
  }));
}
