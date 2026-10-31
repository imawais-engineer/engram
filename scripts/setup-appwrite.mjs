// Idempotent provisioning for Engram on Appwrite (TablesDB + Storage).
// Run with: APPWRITE_API_KEY=... node scripts/setup-appwrite.mjs
// Safe to re-run: existing resources return 409 and are skipped.
import { Client, TablesDB, Storage, Embeddings, Permission, Role, TablesDBIndexType, OrderBy } from 'node-appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6ae5ea70000968dca787';
const key = process.env.APPWRITE_API_KEY;
if (!key) throw new Error('APPWRITE_API_KEY is required');
const DB = process.env.APPWRITE_DATABASE_ID || 'notemind';
const BUCKET = process.env.APPWRITE_BUCKET_ID || 'documents';

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const db = new TablesDB(client);
const storage = new Storage(client);

async function step(name, fn) {
  try { await fn(); console.log('created', name); }
  catch (e) { if (e.code === 409) console.log('exists ', name); else { console.error('FAILED', name, e.code, e.message); process.exitCode = 1; } }
}

const S = { databaseId: DB };
const varchar = (key, size, required = false, extra = {}) => ['varchar', { key, size, required, ...extra }];
const text = (key, required = false) => ['text', { key, required }];
const medium = (key, required = false) => ['mediumtext', { key, required }];
const long = (key, required = false) => ['longtext', { key, required }];
const int = (key, required = false) => ['integer', { key, required }];
const bool = (key, required = false, xdefault) => ['boolean', { key, required, xdefault }];
const dt = (key, required = false) => ['datetime', { key, required }];

const schema = {
  libraries: {
    cols: [varchar('userId', 36, true), varchar('name', 120, true), text('description'), varchar('icon', 16), bool('archived', false, false)],
    idx: [['by_user', ['userId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]]],
  },
  documents: {
    cols: [varchar('userId', 36, true), varchar('libraryId', 36, true), varchar('title', 255, true), varchar('sourceType', 16, true),
      varchar('mimeType', 100), varchar('fileId', 36), int('size'), varchar('status', 16, true), text('error'), int('chunkCount'), medium('content')],
    idx: [['by_user', ['userId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]], ['by_library', ['libraryId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]]],
  },
  chunks: {
    cols: [varchar('userId', 36, true), varchar('libraryId', 36, true), varchar('documentId', 36, true), int('index', true), text('text', true), long('embedding', true), varchar('model', 64)],
    idx: [['by_library', ['libraryId']], ['by_document', ['documentId']], ['by_user', ['userId']]],
  },
  threads: {
    cols: [varchar('userId', 36, true), varchar('title', 160, true), text('description'), text('instructions'), text('summary'),
      varchar('libraryIds', 36, false, { array: true }), varchar('status', 16)],
    idx: [['by_user', ['userId', '$updatedAt'], [OrderBy.Asc, OrderBy.Desc]]],
  },
  memories: {
    cols: [varchar('userId', 36, true), varchar('threadId', 36, true), varchar('type', 24, true), text('content', true),
      varchar('tags', 32, false, { array: true }), long('embedding'), varchar('source', 80), varchar('keyId', 36)],
    idx: [['by_thread', ['threadId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]], ['by_user', ['userId']]],
  },
  keys: {
    cols: [varchar('userId', 36, true), varchar('name', 80, true), varchar('tokenHash', 64, true), varchar('prefix', 16, true),
      bool('allLibraries', false, false), bool('allThreads', false, false), bool('canWrite', false, true),
      varchar('libraryIds', 36, false, { array: true }), varchar('threadIds', 36, false, { array: true }),
      dt('expiresAt'), dt('revokedAt'), dt('lastUsedAt'), varchar('hashVersion', 16)],
    idx: [['by_hash', ['tokenHash'], undefined, TablesDBIndexType.Unique], ['by_user', ['userId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]]],
  },
  activity: {
    cols: [varchar('userId', 36, true), varchar('keyId', 36), varchar('keyName', 80), varchar('action', 48, true), varchar('detail', 255), varchar('status', 16)],
    idx: [['by_user', ['userId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]], ['by_key', ['keyId', '$createdAt'], [OrderBy.Asc, OrderBy.Desc]]],
  },
  // Skills + agents (additive). Relationship tables hold plain ids so the schema stays portable.
  skills: {
    cols: [varchar('userId', 36, true), varchar('name', 120, true), text('description'), varchar('category', 48), varchar('tags', 32, false, { array: true }),
      varchar('status', 16, true), int('currentVersion'), medium('instructions'), text('compatibility')],
    idx: [['by_user', ['userId', '$updatedAt'], [OrderBy.Asc, OrderBy.Desc]], ['by_user_status', ['userId', 'status']]],
  },
  skill_versions: {
    cols: [varchar('userId', 36, true), varchar('skillId', 36, true), int('version', true), varchar('name', 120), text('description'), medium('instructions'), varchar('changeSummary', 255)],
    idx: [['by_skill', ['skillId', 'version'], [OrderBy.Asc, OrderBy.Desc]], ['by_user', ['userId']]],
  },
  agents: {
    cols: [varchar('userId', 36, true), varchar('name', 120, true), text('description'), text('identity'), text('purpose'), medium('systemInstructions'),
      text('responseStyle'), text('constraints'), varchar('preferredClient', 64), varchar('status', 16, true), int('version')],
    idx: [['by_user', ['userId', '$updatedAt'], [OrderBy.Asc, OrderBy.Desc]], ['by_user_status', ['userId', 'status']]],
  },
  agent_skills: {
    cols: [varchar('userId', 36, true), varchar('agentId', 36, true), varchar('skillId', 36, true), int('pinnedVersion')],
    idx: [['by_agent', ['agentId']], ['by_skill', ['skillId']], ['uniq_agent_skill', ['agentId', 'skillId'], undefined, TablesDBIndexType.Unique]],
  },
  agent_libraries: {
    cols: [varchar('userId', 36, true), varchar('agentId', 36, true), varchar('libraryId', 36, true), varchar('access', 16)],
    idx: [['by_agent', ['agentId']], ['by_library', ['libraryId']], ['uniq_agent_library', ['agentId', 'libraryId'], undefined, TablesDBIndexType.Unique]],
  },
};

const creators = {
  varchar: (c, p) => db.createVarcharColumn({ ...c, ...p }),
  text: (c, p) => db.createTextColumn({ ...c, ...p }),
  mediumtext: (c, p) => db.createMediumtextColumn({ ...c, ...p }),
  longtext: (c, p) => db.createLongtextColumn({ ...c, ...p }),
  integer: (c, p) => db.createIntegerColumn({ ...c, ...p }),
  boolean: (c, p) => db.createBooleanColumn({ ...c, ...p }),
  datetime: (c, p) => db.createDatetimeColumn({ ...c, ...p }),
};

// Free plan allows one database and one bucket, and create returns 403 (not 409) once the quota is used, so check first.
await step(`database ${DB}`, async () => { try { await db.get({ databaseId: DB }); throw Object.assign(new Error('exists'), { code: 409 }); } catch (e) { if (e.code === 409) throw e; } return db.create({ databaseId: DB, name: 'Engram' }); });
for (const [tableId, def] of Object.entries(schema)) {
  // Row security on; the app only talks to TablesDB server-side with the API key and
  // checks userId on every read/write. Rows also carry owner-only permissions.
  await step(`table ${tableId}`, () => db.createTable({ ...S, tableId, name: tableId, rowSecurity: true, permissions: [] }));
  const c = { ...S, tableId };
  for (const [type, p] of def.cols) await step(`  ${tableId}.${p.key}`, () => creators[type](c, p));
}
for (const [tableId, def] of Object.entries(schema)) {
  const c = { ...S, tableId };
  for (let i = 0; i < 60; i++) {
    const cols = await db.listColumns(c);
    if (cols.columns.every((x) => x.status === 'available')) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  for (const [k, columns, orders, type] of def.idx) {
    await step(`  index ${tableId}.${k}`, () => db.createIndex({ ...c, key: k, type: type || TablesDBIndexType.Key, columns, ...(orders ? { orders } : {}) }));
  }
}

await step(`bucket ${BUCKET}`, async () => { try { await storage.getBucket({ bucketId: BUCKET }); throw Object.assign(new Error('exists'), { code: 409 }); } catch (e) { if (e.code === 409) throw e; } return storage.createBucket({
  bucketId: BUCKET, name: 'Engram documents', permissions: [], fileSecurity: true, enabled: true,
  maximumFileSize: 10 * 1024 * 1024, allowedFileExtensions: ['pdf', 'txt', 'md', 'markdown'],
}); });

const emb = await new Embeddings(client).createTextEmbeddings({ texts: ['hello world'] });
console.log('embedding check:', emb.embeddings[0].model, emb.embeddings[0].dimension, emb.embeddings[0].error || 'ok');
