// End-to-end acceptance test for Engram: dashboard API + MCP server.
// Usage: BASE=http://localhost:3000 APPWRITE_API_KEY=... node scripts/acceptance.mjs
import { readFileSync } from 'node:fs';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client, TablesDB, Users, Query } from 'node-appwrite';

const BASE = process.env.BASE || 'http://localhost:3000';
const admin = new Client().setEndpoint('https://sfo.cloud.appwrite.io/v1').setProject('6a5788c00031e7384f3b').setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(admin), users = new Users(admin);
let pass = 0, failed = 0;
const created = [];
function check(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name, extra); } }

function session() {
  let cookie = '';
  const call = async (method, path, body, isForm) => {
    const res = await fetch(BASE + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}) }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) json.__status = res.status;
    return json;
  };
  return call;
}

async function mcp(token) {
  const client = new McpClient({ name: 'acceptance', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = r.content?.[0]?.text || '';
    return { isError: !!r.isError, text, data: r.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}
async function mcpFails(token) { try { await mcp(token); return false; } catch (e) { return /401|invalid|revoked|Unauthorized/i.test(String(e)); } }

const t0 = Date.now();
const stamp = Date.now();
console.log('Engram acceptance against', BASE);

console.log('\n1. Accounts');
const A = session(), B = session();
const emailA = `accept-a+${stamp}@engram.test`, emailB = `accept-b+${stamp}@engram.test`;
check('register user A', (await A('POST', '/api/auth/signup', { name: 'Tester A', email: emailA, password: 'Engram2026!x' })).ok);
check('register user B', (await B('POST', '/api/auth/signup', { name: 'Tester B', email: emailB, password: 'Engram2026!x' })).ok);
const meA = await A('GET', '/api/me');
check('session works', meA.user?.email === emailA);

console.log('\n2. Libraries + documents');
const lib = (await A('POST', '/api/libraries', { name: 'Project Atlas', description: 'Courier tracking app' })).library;
const priv = (await A('POST', '/api/libraries', { name: 'Private journal' })).library;
check('create libraries', lib?.id && priv?.id);
const form = new FormData();
form.append('file', new Blob([readFileSync('docs/sample/atlas-architecture.pdf')], { type: 'application/pdf' }), 'atlas-architecture.pdf');
const up = await A('POST', `/api/libraries/${lib.id}/documents`, form, true);
check('upload PDF → indexed', up.document?.status === 'indexed' && up.document.chunkCount > 0, JSON.stringify(up).slice(0, 300));
const txt = await A('POST', `/api/libraries/${lib.id}/documents`, { title: 'Standup notes', content: 'We agreed to use Appwrite Realtime for rider locations. The SMS gateway decision is still open. Ali owns the rider app offline queue.' });
check('add text document → indexed', txt.document?.status === 'indexed');
const privDoc = await A('POST', `/api/libraries/${priv.id}/documents`, { title: 'Secret', content: 'My bank PIN reminder: the blue notebook. Realtime courier dashboards are cool.' });
check('private doc indexed', privDoc.document?.status === 'indexed');
const s = await A('POST', '/api/search', { query: 'how do live rider locations update?', libraryIds: [lib.id] });
check('semantic search finds Realtime passage', s.results?.[0]?.text?.includes('Realtime'), JSON.stringify(s).slice(0, 200));
check('search has citations', s.results?.[0]?.documentTitle && Number.isInteger(s.results?.[0]?.chunkIndex));

console.log('\n3. Threads + keys');
const thread = (await A('POST', '/api/threads', { title: 'Atlas MVP build', instructions: 'Use TypeScript. Keep the MVP scope tight.', libraryIds: [lib.id] })).thread;
const other = (await A('POST', '/api/threads', { title: 'Personal' })).thread;
check('create threads', thread?.id && other?.id && thread.libraryIds.includes(lib.id));
const scope = { libraryIds: [lib.id], threadIds: [thread.id], expiresInDays: 7 };
const kA = await A('POST', '/api/keys', { name: 'Claude Desktop', ...scope });
const kB = await A('POST', '/api/keys', { name: 'Cursor', ...scope });
const kR = await A('POST', '/api/keys', { name: 'Read-only bot', ...scope, canWrite: false });
check('create keys, token shown once', kA.token?.startsWith('eng_') && kB.token && kR.token);
const keys = await A('GET', '/api/keys');
check('key list never returns token or hash', !JSON.stringify(keys).includes(kA.token) && !JSON.stringify(keys).includes('tokenHash'));

console.log('\n4. MCP');
check('unauthenticated request rejected', (await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).status === 401);
check('garbage token rejected', await mcpFails('eng_thisisnotarealkeyatall1234567'));
const a = await mcp(kA.token);
const tools = (await a.client.listTools()).tools.map((t) => t.name).sort();
check('10 tools exposed', tools.length === 10, tools.join(','));
const libs = await a.call('list_libraries');
check('list_libraries only shows scoped library', libs.data?.libraries?.length === 1 && libs.data.libraries[0].id === lib.id);
const sr = await a.call('search_library', { query: 'what happens when the network is bad?' });
check('search_library returns cited passage', sr.data?.results?.[0]?.text?.toLowerCase().includes('offline'), sr.text.slice(0, 200));
const oos = await a.call('search_library', { query: 'pin', libraryId: priv.id });
check('out-of-scope library blocked', oos.isError && /scope/.test(oos.text));
const oosDoc = await a.call('get_document', { documentId: privDoc.document.id });
check('out-of-scope document blocked', oosDoc.isError);
const oosT = await a.call('get_thread_context', { threadId: other.id });
check('out-of-scope thread blocked', oosT.isError);
const doc = await a.call('get_document', { documentId: up.document.id, maxChars: 500 });
check('get_document pages text', doc.data?.text?.length === 500 && doc.data.nextOffset === 500);
const saved = await a.call('save_memory', { threadId: thread.id, type: 'DECISION', content: 'Use Twilio-alternative Jazz SMS gateway for Pakistani numbers; batch messages hourly.', tags: ['sms'] });
check('save_memory via key A', saved.data?.saved?.id);
const upd = await a.call('update_memory', { memoryId: saved.data.saved.id, content: 'Use the Jazz SMS gateway for Pakistani numbers; batch messages hourly.' });
check('update_memory', upd.data?.updated?.content?.startsWith('Use the Jazz'));
const b = await mcp(kB.token);
const ctx = await b.call('get_thread_context', { threadId: thread.id });
check('key B sees key A memory (cross-tool)', ctx.data?.memories?.DECISION?.some((m) => m.content.includes('Jazz') && m.source === 'Claude Desktop'), ctx.text.slice(0, 300));
const sm = await b.call('search_memory', { query: 'which text message provider did we pick?' });
check('search_memory semantic', sm.data?.results?.[0]?.content?.includes('Jazz'));
const lt = await b.call('list_threads');
check('list_threads scoped', lt.data?.threads?.length === 1);
const ll = await b.call('link_library', { threadId: thread.id, libraryId: priv.id });
check('link_library out-of-scope blocked', ll.isError);
const ld = await b.call('list_documents', { libraryId: lib.id });
check('list_documents', ld.data?.documents?.length === 2);
const res = await b.client.listResources();
check('resources listed', res.resources.some((r) => r.uri === 'engram://workspace') && res.resources.some((r) => r.uri === `engram://threads/${thread.id}`));
const ws = await b.client.readResource({ uri: 'engram://workspace' });
check('read engram://workspace', JSON.parse(ws.contents[0].text).libraries.length === 1);
const dr = await b.client.readResource({ uri: `engram://documents/${txt.document.id}` });
check('read engram://documents/{id}', dr.contents[0].text.includes('Standup'));
const prompts = (await b.client.listPrompts()).prompts.map((p) => p.name);
check('3 prompts', ['load_project_context', 'research_library', 'resume_previous_work'].every((p) => prompts.includes(p)));
const pr = await b.client.getPrompt({ name: 'resume_previous_work', arguments: { threadId: thread.id } });
check('get prompt', pr.messages[0].content.text.includes(thread.id));
const r = await mcp(kR.token);
const ro = await r.call('save_memory', { threadId: thread.id, type: 'FACT', content: 'should fail' });
check('read-only key cannot write', ro.isError && /read-only/.test(ro.text));

console.log('\n5. Cross-user isolation');
const kX = await B('POST', '/api/keys', { name: 'B all-access', allLibraries: true, allThreads: true });
const x = await mcp(kX.token);
check('user B sees none of A libraries', (await x.call('list_libraries')).data?.libraries?.length === 0);
check('user B cannot read A document', (await x.call('get_document', { documentId: up.document.id })).isError);
check('user B cannot read A thread', (await x.call('get_thread_context', { threadId: thread.id })).isError);
check('user B search over A library returns nothing', ((await x.call('search_library', { query: 'rider', libraryId: lib.id })).data?.results?.length ?? 0) === 0);
check('user B cannot write to A thread', (await x.call('save_memory', { threadId: thread.id, type: 'FACT', content: 'intrusion' })).isError);
check('dashboard API blocks cross-user', (await B('GET', `/api/threads/${thread.id}`)).__status === 404);
check('user B cannot create key scoped to A library', (await B('POST', '/api/keys', { name: 'sneaky', libraryIds: [lib.id] })).key?.libraryIds?.length === 0);

console.log('\n6. Revoke / rotate / activity');
await A('POST', `/api/keys/${kA.key.id}/revoke`);
check('revoked key rejected', await mcpFails(kA.token));
const rot = await A('POST', `/api/keys/${kB.key.id}/rotate`);
check('rotate: old key rejected', await mcpFails(kB.token));
const nb = await mcp(rot.token);
check('rotate: new key works with same scope', (await nb.call('list_threads')).data?.threads?.length === 1);
const act = await A('GET', '/api/activity?limit=50');
check('activity logged (save_memory by Claude Desktop)', act.activity?.some((x) => x.action === 'tool.save_memory' && x.keyName === 'Claude Desktop'));
check('denied access logged', act.activity?.some((x) => x.status === 'denied'));
const ks = (await A('GET', '/api/keys')).keys;
check('lastUsedAt recorded', ks.find((k) => k.id === kR.key.id)?.lastUsedAt);

console.log('\n7. Cascade delete');
const before = (await db.listRows({ databaseId: 'notemind', tableId: 'chunks', queries: [Query.equal('documentId', up.document.id), Query.limit(1)] })).total;
await A('DELETE', `/api/documents/${up.document.id}`);
const after = (await db.listRows({ databaseId: 'notemind', tableId: 'chunks', queries: [Query.equal('documentId', up.document.id), Query.limit(1)] })).total;
check(`delete document removes chunks (${before} → ${after})`, before > 0 && after === 0);
check('deleted document gone', (await A('GET', `/api/documents/${up.document.id}`)).__status === 404);

console.log('\nCleanup');
for (const call of [A, B]) {
  for (const l of (await call('GET', '/api/libraries')).libraries || []) await call('DELETE', `/api/libraries/${l.id}`);
  for (const t of (await call('GET', '/api/threads')).threads || []) await call('DELETE', `/api/threads/${t.id}`);
  for (const k of (await call('GET', '/api/keys')).keys || []) await call('DELETE', `/api/keys/${k.id}`);
}
for (const e of [emailA, emailB]) {
  const u = (await users.list({ queries: [Query.equal('email', e)] })).users[0];
  if (u) { await db.deleteRows({ databaseId: 'notemind', tableId: 'activity', queries: [Query.equal('userId', u.$id)] }); await users.delete({ userId: u.$id }); }
}
console.log(`\n${pass} passed, ${failed} failed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
