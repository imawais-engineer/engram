// One-time provisioning for NoteMind (idempotent).
// Creates a TablesDB database + `notes` table with typed columns and indexes.
// Run with: APPWRITE_API_KEY=... node scripts/setup-appwrite.mjs
import { Client, TablesDB, Embeddings, Permission, Role, TablesDBIndexType, OrderBy } from 'node-appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a5788c00031e7384f3b';
const key = process.env.APPWRITE_API_KEY;
if (!key) throw new Error('APPWRITE_API_KEY is required');

const DB = process.env.APPWRITE_DATABASE_ID || 'notemind';
const T = process.env.APPWRITE_NOTES_TABLE_ID || 'notes';

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const db = new TablesDB(client);

async function step(name, fn) {
  try { await fn(); console.log('created', name); }
  catch (e) { if (e.code === 409) console.log('exists ', name); else { console.error('FAILED', name, e.code, e.message); process.exitCode = 1; } }
}

await step('database notemind', () => db.create({ databaseId: DB, name: 'NoteMind' }));
await step('table notes', () => db.createTable({
  databaseId: DB, tableId: T, name: 'notes', rowSecurity: true,
  permissions: [Permission.create(Role.users())],
}));
const c = { databaseId: DB, tableId: T };
await step('col userId', () => db.createVarcharColumn({ ...c, key: 'userId', size: 36, required: true }));
await step('col title', () => db.createVarcharColumn({ ...c, key: 'title', size: 200, required: true }));
await step('col subject', () => db.createVarcharColumn({ ...c, key: 'subject', size: 64, required: false, xdefault: 'General' }));
await step('col tags', () => db.createVarcharColumn({ ...c, key: 'tags', size: 32, required: false, array: true }));
await step('col content', () => db.createMediumtextColumn({ ...c, key: 'content', required: true }));
await step('col embedding', () => db.createLongtextColumn({ ...c, key: 'embedding', required: true }));
await step('col model', () => db.createVarcharColumn({ ...c, key: 'model', size: 64, required: false }));

// wait for columns to be available before indexing
for (let i = 0; i < 30; i++) {
  const cols = await db.listColumns(c);
  if (cols.columns.every((x) => x.status === 'available')) break;
  await new Promise((r) => setTimeout(r, 1000));
}
await step('index userId+createdAt', () => db.createIndex({ ...c, key: 'by_user', type: TablesDBIndexType.Key, columns: ['userId', '$createdAt'], orders: [OrderBy.Asc, OrderBy.Desc] }));
await step('index userId+subject', () => db.createIndex({ ...c, key: 'by_user_subject', type: TablesDBIndexType.Key, columns: ['userId', 'subject'] }));

const emb = await new Embeddings(client).createTextEmbeddings({ texts: ['hello world'] });
console.log('embedding check:', emb.embeddings[0].model, emb.embeddings[0].dimension, emb.embeddings[0].error || 'ok');
