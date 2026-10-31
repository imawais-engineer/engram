// Seeds a demo workspace for recording: libraries, a thread with memories saved by two AI-tool keys.
// Usage: BASE=https://engram-ai.appwrite.network node scripts/seed-demo.mjs   (writes DEMO_ACCOUNT.txt, which is gitignored)
import { readFileSync, writeFileSync } from 'node:fs';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.BASE || 'http://localhost:3000';
const email = process.env.DEMO_EMAIL || `demo+${Date.now()}@engram.app`;
const password = process.env.DEMO_PASSWORD || 'Engram2026!';
let cookie = '';
async function call(method, path, body, form) {
  const res = await fetch(BASE + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const sc = res.headers.getSetCookie?.() || [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${j.error}`);
  return j;
}
const up = (libId, file, mime) => { const f = new FormData(); f.append('file', new Blob([readFileSync(file)], { type: mime }), file.split('/').pop()); return call('POST', `/api/libraries/${libId}/documents`, null, f); };

await call('POST', '/api/auth/signup', { name: 'Awais (demo)', email, password });
const atlas = (await call('POST', '/api/libraries', { name: 'Project Atlas', icon: '🚀', description: 'Requirements, architecture and standup notes for the Atlas courier-tracking MVP.' })).library;
const handbook = (await call('POST', '/api/libraries', { name: 'Engineering handbook', icon: '🛠️', description: 'Team coding conventions, review and release rules.' })).library;
for (const [lib, file, mime] of [[atlas, 'docs/sample/atlas-architecture.pdf', 'application/pdf'], [atlas, 'docs/sample/standup-notes.md', 'text/markdown'], [handbook, 'docs/sample/engineering-handbook.md', 'text/markdown']]) {
  const d = (await up(lib.id, file, mime)).document; console.log('doc', d.title, d.status, d.chunkCount);
}
const thread = (await call('POST', '/api/threads', {
  title: 'Atlas MVP build', description: 'Shipping the courier-tracking MVP before the Eid rush',
  instructions: 'Use TypeScript and the engineering handbook rules. Keep MVP scope tight: no card payments, no route optimiser. Treat DECISION memories as settled unless the user reopens them.',
  summary: 'Rider app offline queue works; dispatcher live map is on Appwrite Realtime. Open: SMS gateway choice, photo compression.',
  libraryIds: [atlas.id, handbook.id],
})).thread;
await call('POST', `/api/threads/${thread.id}/memories`, { type: 'PREFERENCE', content: 'Explain trade-offs briefly, then recommend one option.', tags: ['style'] });
const scope = { libraryIds: [atlas.id, handbook.id], threadIds: [thread.id], expiresInDays: 30 };
const cc = await call('POST', '/api/keys', { name: 'Laptop agent', ...scope });
const cur = await call('POST', '/api/keys', { name: 'Research agent', ...scope });
async function mcp(token) {
  const c = new McpClient({ name: 'seed', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return (name, args) => c.callTool({ name, arguments: args });
}
const a = await mcp(cc.token);
await a('search_library', { query: 'how do live rider locations update?' });
await a('save_memory', { threadId: thread.id, type: 'DECISION', content: 'Live rider locations use Appwrite Realtime pushes every 15 seconds; no polling.', tags: ['architecture'] });
await a('save_memory', { threadId: thread.id, type: 'FACT', content: 'Proof-of-delivery photos are stored in Appwrite Storage and compressed to 1280px on device.', tags: ['storage'] });
await a('save_memory', { threadId: thread.id, type: 'TASK', content: 'Compare two SMS gateways for Pakistani numbers (cost per message, delivery reports) and pick one.', tags: ['sms'] });
const b = await mcp(cur.token);
await b('get_thread_context', { threadId: thread.id });
await b('save_memory', { threadId: thread.id, type: 'PROJECT_STATE', content: 'COD reconciliation screen drafted; totals check against cod_ledger at shift end. Next: offline photo upload queue.', tags: ['cod'] });
await b('save_memory', { threadId: thread.id, type: 'DECISION', content: 'Route optimiser is out of MVP scope; dispatchers assign parcels manually until v2.', tags: ['scope'] });

writeFileSync('DEMO_ACCOUNT.txt', `Engram demo account (do not commit)\nURL: ${BASE}\nEmail: ${email}\nPassword: ${password}\nThread: Atlas MVP build (${thread.id})\nLibraries: Project Atlas (${atlas.id}), Engineering handbook (${handbook.id})\n\nMCP keys (shown once in the UI; saved here for the demo recording):\nLaptop agent (key A): ${cc.token}\nResearch agent (key B): ${cur.token}\n\nCreated ${new Date().toISOString()}\n`);
console.log('seeded', email, 'thread', thread.id);
