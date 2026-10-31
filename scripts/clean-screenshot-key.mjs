// Removes the throwaway "VS Code" key (and its activity) that the screenshot run creates for the demo user.
import { Client, TablesDB, Users, Query } from 'node-appwrite';
const c = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1').setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a5788c00031e7384f3b').setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(c), DB = process.env.APPWRITE_DATABASE_ID || 'notemind', name = process.argv[3] || 'VS Code';
const [u] = (await new Users(c).list({ queries: [Query.equal('email', process.argv[2] || 'demo@engram-demo.app')] })).users;
const k = await db.deleteRows({ databaseId: DB, tableId: 'keys', queries: [Query.equal('userId', u.$id), Query.equal('name', name)] });
const a = await db.deleteRows({ databaseId: DB, tableId: 'activity', queries: [Query.equal('userId', u.$id), Query.equal('keyName', name)] });
console.log('removed keys', k.total, 'activity', a.total);
