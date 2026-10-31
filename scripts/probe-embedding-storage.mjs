// Verifies 768-dim embeddings round-trip through a TablesDB longtext column and reports sizes.
// Usage: APPWRITE_API_KEY=... node scripts/probe-embedding-storage.mjs
import { Client, TablesDB, Embeddings, ID, Query } from 'node-appwrite';
const c = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1').setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6ae5ea70000968dca787').setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(c), DB = process.env.APPWRITE_DATABASE_ID || 'notemind';
const text = 'search_document: ' + 'Riders queue status updates offline and sync when the network returns. '.repeat(12);
const [e] = (await new Embeddings(c).createTextEmbeddings({ texts: [text.slice(0, 900)] })).embeddings;
const rounded = e.embedding.map((x) => Math.round(x * 1e6) / 1e6);
const json = JSON.stringify(rounded);
const full = JSON.stringify(e.embedding);
console.log(`model=${e.model} dims=${e.dimension} json(rounded 1e-6)=${json.length} bytes, json(full precision)=${full.length} bytes`);
const results = [];
for (const [label, payload] of [['rounded', json], ['full', full]]) {
  const t0 = Date.now();
  const row = await db.createRow({ databaseId: DB, tableId: 'chunks', rowId: ID.unique(), data: { userId: 'probe', libraryId: 'probe', documentId: 'probe', index: 0, text: text.slice(0, 900), embedding: payload, model: e.model } });
  const back = await db.getRow({ databaseId: DB, tableId: 'chunks', rowId: row.$id });
  const v = JSON.parse(back.embedding);
  const maxErr = Math.max(...v.map((x, i) => Math.abs(x - e.embedding[i])));
  results.push({ label, bytes: payload.length, dims: v.length, exact: back.embedding === payload, maxAbsErrorVsOriginal: maxErr, ms: Date.now() - t0 });
}
// Bulk: 50 rows in one createRows call (the batch size the app uses).
const t1 = Date.now();
const bulk = await db.createRows({ databaseId: DB, tableId: 'chunks', rows: Array.from({ length: 50 }, (_, i) => ({ $id: ID.unique(), userId: 'probe', libraryId: 'probe', documentId: 'probe', index: i, text: text.slice(0, 900), embedding: json, model: e.model })) });
const listed = await db.listRows({ databaseId: DB, tableId: 'chunks', queries: [Query.equal('documentId', 'probe'), Query.limit(100)] });
results.push({ label: 'bulk createRows x50 + list', created: bulk.total, rows: listed.total, allParse: listed.rows.every((r) => JSON.parse(r.embedding).length === 768), ms: Date.now() - t1 });
await db.deleteRows({ databaseId: DB, tableId: 'chunks', queries: [Query.equal('documentId', 'probe')] });
console.table(results);
