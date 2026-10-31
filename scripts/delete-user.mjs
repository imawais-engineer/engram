// Deletes Engram users and all their rows/files. Usage: node scripts/delete-user.mjs <email-or-prefix>...
// A trailing * matches by prefix (e.g. "accept-a+*").
import { Client, TablesDB, Users, Storage, Query } from 'node-appwrite';
const c = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1').setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6ae5ea70000968dca787').setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(c), users = new Users(c), storage = new Storage(c), DB = process.env.APPWRITE_DATABASE_ID || 'notemind';
for (const pat of process.argv.slice(2)) {
  const q = pat.endsWith('*') ? [Query.startsWith('email', pat.slice(0, -1)), Query.limit(100)] : [Query.equal('email', pat)];
  for (const u of (await users.list({ queries: q })).users) {
    const docs = await db.listRows({ databaseId: DB, tableId: 'documents', queries: [Query.equal('userId', u.$id), Query.limit(500), Query.select(['fileId'])] });
    for (const d of docs.rows) if (d.fileId) await storage.deleteFile({ bucketId: 'documents', fileId: d.fileId }).catch(() => {});
    for (const t of ['chunks', 'documents', 'libraries', 'memories', 'threads', 'keys', 'activity', 'skill_versions', 'skills', 'agent_skills', 'agent_libraries', 'agents'])
      for (let i = 0; i < 20; i++) { const r = await db.deleteRows({ databaseId: DB, tableId: t, queries: [Query.equal('userId', u.$id)] }); if (!r.total) break; }
    await users.delete({ userId: u.$id });
    console.log('deleted', u.email);
  }
}
