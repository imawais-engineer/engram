import "server-only";
import { ID, Query } from "node-appwrite";
import { DATABASE_ID, T } from "./appwrite";
import { listAll, ownerPerms, tables } from "./db";
import { cosine, EMBED_MODEL, keywordScore } from "./embed";

export type VectorRecord = { userId: string; libraryId: string; documentId: string; index: number; text: string; vector: number[] };
export type VectorSearchInput = { userId: string; libraryIds: string[]; vector: number[]; query: string; limit: number };
export type VectorResult = { id: string; libraryId: string; documentId: string; index: number; text: string; score: number; semantic: number; keyword: number };

/**
 * Storage-agnostic vector interface. The MCP server and UI only talk to this.
 * Today it is backed by TablesDB (Appwrite Free plan allows a single database, so a
 * separate VectorsDB database can't be created). A VectorsDB implementation can be
 * dropped in behind the same three methods.
 */
export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorResult[]>;
  deleteByDocument(userId: string, documentId: string): Promise<void>;
}

type ChunkRow = { $id: string; userId: string; libraryId: string; documentId: string; index: number; text: string; embedding: string };

export class TablesDBVectorStore implements VectorStore {
  async upsert(records: VectorRecord[]) {
    const t = tables();
    for (let i = 0; i < records.length; i += 50) {
      const rows = records.slice(i, i + 50).map((r) => ({
        $id: ID.unique(),
        $permissions: ownerPerms(r.userId),
        userId: r.userId,
        libraryId: r.libraryId,
        documentId: r.documentId,
        index: r.index,
        text: r.text,
        embedding: JSON.stringify(r.vector.map((x) => Math.round(x * 1e6) / 1e6)),
        model: EMBED_MODEL,
      }));
      await t.createRows({ databaseId: DATABASE_ID, tableId: T.chunks, rows });
    }
  }

  /** Hybrid ranking: cosine similarity (85%) + keyword overlap (15%), brute force over the scoped libraries. */
  async search({ userId, libraryIds, vector, query, limit }: VectorSearchInput) {
    if (!libraryIds.length) return [];
    const rows = await listAll<ChunkRow>(T.chunks, [Query.equal("libraryId", libraryIds), Query.equal("userId", userId)], 20000);
    const scored = rows.map((r) => {
      const semantic = cosine(vector, JSON.parse(r.embedding || "[]"));
      const keyword = keywordScore(query, r.text);
      return { id: r.$id, libraryId: r.libraryId, documentId: r.documentId, index: r.index, text: r.text, semantic, keyword, score: semantic * 0.85 + keyword * 0.15 };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async deleteByDocument(userId: string, documentId: string) {
    // Bulk delete may cap rows per call, so repeat until nothing is left.
    for (let i = 0; i < 50; i++) {
      const res = await tables().deleteRows({ databaseId: DATABASE_ID, tableId: T.chunks, queries: [Query.equal("documentId", documentId), Query.equal("userId", userId)] });
      if (!res.total) break;
    }
  }
}

export const vectorStore: VectorStore = new TablesDBVectorStore();
