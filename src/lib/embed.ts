import "server-only";
import { createAdminClient } from "./appwrite";

export const EMBED_MODEL = "nomic-embed-text"; // Appwrite built-in embedding model, 768 dimensions
const BATCH = 16;
const PARALLEL = 3;

/** Embeds texts with Appwrite Embeddings in small parallel batches (the API caps at 100 texts, and big batches time out). */
export async function embed(texts: string[]): Promise<number[][]> {
  const { embeddings } = createAdminClient();
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH));
  const results: number[][][] = new Array(batches.length);
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const i = next++;
      const res = await embeddings.createTextEmbeddings({ texts: batches[i].map((t) => t.slice(0, 8000) || " ") });
      results[i] = res.embeddings.map((e) => {
        if (e.error || !e.embedding?.length) throw new Error(`Embedding failed: ${e.error || "empty vector"}`);
        return e.embedding;
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
  return results.flat();
}

/** nomic-embed-text expects task prefixes; they noticeably improve retrieval. */
export const asDoc = (t: string) => `search_document: ${t}`;
export const asQuery = (t: string) => `search_query: ${t.slice(0, 2000)}`;

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Simple keyword score: fraction of query terms (3+ chars) present in the text. */
export function keywordScore(query: string, text: string) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
  if (!terms.length) return 0;
  const hay = text.toLowerCase();
  return terms.filter((t) => hay.includes(t)).length / terms.length;
}
