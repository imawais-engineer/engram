// Acceptance for Skills, Agents, get_agent_context, key hardening, Origin validation and the /api/mcp alias.
// Usage: BASE=https://engram-ai.appwrite.network APPWRITE_API_KEY=... node scripts/acceptance-v2.mjs
import { createHash, randomBytes } from 'node:crypto';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client, TablesDB, Users, Query, ID, Permission, Role } from 'node-appwrite';

const BASE = process.env.BASE || 'http://localhost:3000';
const admin = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1').setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6ae5ea70000968dca787').setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(admin), users = new Users(admin), DB = 'notemind';
let pass = 0, failed = 0;
function check(name, cond, extra = '') { if (cond) { pass++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name, extra); } }
const st = (r) => r.__status || 200;

function session() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(BASE + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.() || [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) json.__status = res.status;
    return json;
  };
}
async function mcp(token, path = '/mcp') {
  const client = new McpClient({ name: 'acceptance-v2', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(BASE + path), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = r.content?.[0]?.text || '';
    return { isError: !!r.isError, text, data: r.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}
const rawPost = (path, headers, body = { jsonrpc: '2.0', id: 1, method: 'tools/list' }) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });

const t0 = Date.now(), stamp = Date.now();
console.log('Engram v2 acceptance against', BASE);
const A = session(), B = session();
const emailA = `accept2-a+${stamp}@engram.test`, emailB = `accept2-b+${stamp}@engram.test`;
check('register users A and B', (await A('POST', '/api/auth/signup', { name: 'V2 A', email: emailA, password: 'Engram2026!x' })).ok && (await B('POST', '/api/auth/signup', { name: 'V2 B', email: emailB, password: 'Engram2026!x' })).ok);

// Fixture: two libraries (one the key can see, one it can't), a thread.
const libPub = (await A('POST', '/api/libraries', { name: 'Atlas specs' })).library;
const libSecret = (await A('POST', '/api/libraries', { name: 'Finance secrets' })).library;
await A('POST', `/api/libraries/${libPub.id}/documents`, { title: 'Offline queue', content: 'Riders on poor networks: the app queues status updates offline and syncs them later when the connection returns.' });
await A('POST', `/api/libraries/${libSecret.id}/documents`, { title: 'Payroll', content: 'Payroll account offline backup codes are kept in the red folder. Queue syncs for payroll happen monthly.' });
const thread = (await A('POST', '/api/threads', { title: 'Atlas sprint', summary: 'Offline queue shipped; SMS gateway open.' })).thread;
check('fixture: libraries + thread', libPub?.id && libSecret?.id && thread?.id);

console.log('\n1. Skills CRUD + versions (dashboard API)');
const sk = (await A('POST', '/api/skills', { name: 'Code review', description: 'Review diffs', instructions: 'v1: check tests first.', tags: ['review'], category: 'engineering' })).skill;
check('create skill (draft, v1)', sk?.id && sk.status === 'draft' && sk.version === 1);
const sk2 = (await A('PATCH', `/api/skills/${sk.id}`, { instructions: 'v2: check tests, then security.', changeSummary: 'Add security' })).skill;
check('edit instructions → v2', sk2?.version === 2 && sk2.instructions.startsWith('v2'));
const sk2b = (await A('PATCH', `/api/skills/${sk.id}`, { status: 'published' })).skill;
check('publish does not bump version', sk2b?.status === 'published' && sk2b.version === 2);
const vers = (await A('GET', `/api/skills/${sk.id}/versions`)).versions;
check('version history has v2, v1', vers?.length === 2 && vers[0].version === 2 && vers[1].instructions.startsWith('v1'));
const rest = (await A('POST', `/api/skills/${sk.id}/restore`, { version: 1 })).skill;
check('restore v1 → new v3 with v1 content', rest?.version === 3 && rest.instructions.startsWith('v1'));
const dup = (await A('POST', `/api/skills/${sk.id}/duplicate`)).skill;
check('duplicate → new draft copy', dup?.id && dup.id !== sk.id && dup.status === 'draft' && dup.name.includes('copy'));
const fresh = session();
await fresh('POST', '/api/auth/login', { email: emailA, password: 'Engram2026!x' });
check('skill persists across sessions (re-login + GET)', (await fresh('GET', `/api/skills/${sk.id}`)).skill?.version === 3);
const draftSkill = (await A('POST', '/api/skills', { name: 'Unfinished', instructions: 'DRAFT-ONLY-TEXT' })).skill;

console.log('\n2. Agents CRUD + relationships (dashboard API)');
const ag = (await A('POST', '/api/agents', { name: 'Atlas reviewer', identity: 'Senior reviewer for Atlas', systemInstructions: 'Be concise.', purpose: 'Review Atlas code' })).agent;
check('create agent (active)', ag?.id && ag.status === 'active');
await A('POST', `/api/agents/${ag.id}/skills`, { skillId: sk.id });
await A('POST', `/api/agents/${ag.id}/skills`, { skillId: draftSkill.id });
await A('POST', `/api/agents/${ag.id}/libraries`, { libraryId: libPub.id });
const ag2 = (await A('POST', `/api/agents/${ag.id}/libraries`, { libraryId: libSecret.id })).agent;
check('assign 2 skills + 2 libraries', ag2?.skills?.length === 2 && ag2.libraries.length === 2);
check('assigning twice is idempotent', (await A('POST', `/api/agents/${ag.id}/skills`, { skillId: sk.id })).agent?.skills?.length === 2);
check('update agent', (await A('PATCH', `/api/agents/${ag.id}`, { responseStyle: 'Bullets', status: 'active' })).agent?.responseStyle === 'Bullets');
const prev = await A('POST', `/api/agents/${ag.id}/context`, { query: 'what happens offline?', maxChars: 4000 });
check('owner preview: published skill in, draft skill out', prev.context?.includes('v1: check tests first.') && !prev.context.includes('DRAFT-ONLY-TEXT') && prev.skippedDraftSkills === 1);
const tmpAgent = (await A('POST', '/api/agents', { name: 'Temp', skillIds: [dup.id], libraryIds: [libPub.id] })).agent;
await A('DELETE', `/api/skills/${dup.id}`);
check('deleting a skill removes its versions + agent links', (await A('GET', `/api/agents/${tmpAgent.id}`)).agent?.skills?.length === 0 && (await db.listRows({ databaseId: DB, tableId: 'skill_versions', queries: [Query.equal('skillId', dup.id), Query.limit(1)] })).total === 0);
await A('DELETE', `/api/agents/${tmpAgent.id}`);
check('deleting an agent removes its links', (await db.listRows({ databaseId: DB, tableId: 'agent_libraries', queries: [Query.equal('agentId', tmpAgent.id), Query.limit(1)] })).total === 0 && st(await A('GET', `/api/agents/${tmpAgent.id}`)) === 404);

console.log('\n3. Keys: new HMAC keys + legacy SHA-256 keys');
const kRW = await A('POST', '/api/keys', { name: 'RW scoped', libraryIds: [libPub.id], threadIds: [thread.id] });
const kRO = await A('POST', '/api/keys', { name: 'RO scoped', libraryIds: [libPub.id], threadIds: [thread.id], canWrite: false });
const kAll = await A('POST', '/api/keys', { name: 'RW all', allLibraries: true, allThreads: true });
const kMcp = await A('POST', '/api/keys', { name: 'RW all 2', allLibraries: true, allThreads: true }); // separate key: 60 req/min limit per key
check('new keys use engram_ prefix', [kRW, kRO, kAll, kMcp].every((k) => k.token?.startsWith('engram_')));
const row = (await db.listRows({ databaseId: DB, tableId: 'keys', queries: [Query.equal('$id', kRW.key.id)] })).rows[0];
check('stored hash is HMAC (not plain SHA-256) and marked v2', row.hashVersion === 'hmac-sha256-v2' && row.tokenHash !== createHash('sha256').update(kRW.token).digest('hex') && !JSON.stringify(row).includes(kRW.token));
const listed = await A('GET', '/api/keys');
check('key list shows hash version, never token/hash', listed.keys?.find((k) => k.id === kRW.key.id)?.hashVersion === 'hmac-sha256-v2' && !JSON.stringify(listed).includes('tokenHash') && !JSON.stringify(listed).includes(kRW.token));
const uA = (await users.list({ queries: [Query.equal('email', emailA)] })).users[0];
const legacy = `eng_${randomBytes(24).toString('base64url')}`;
await db.createRow({ databaseId: DB, tableId: 'keys', rowId: ID.unique(), permissions: [Permission.read(Role.user(uA.$id))], data: { userId: uA.$id, name: 'Legacy key', tokenHash: createHash('sha256').update(legacy).digest('hex'), prefix: legacy.slice(0, 12), allLibraries: true, allThreads: true, canWrite: true } });
const leg = await mcp(legacy);
check('legacy eng_ (SHA-256) key still authenticates', (await leg.call('list_libraries')).data?.libraries?.length === 2);
check('forged engram_ token rejected', (await rawPost('/mcp', { authorization: `Bearer engram_${randomBytes(32).toString('base64url')}` })).status === 401);
check('legacy hash presented with engram_ prefix rejected', (await rawPost('/mcp', { authorization: `Bearer engram_${legacy.slice(4)}` })).status === 401);

console.log('\n4. Endpoints + Origin validation');
const viaApi = await mcp(kAll.token, '/api/mcp');
const toolsApi = (await viaApi.client.listTools()).tools.map((t) => t.name);
const toolsMcp = (await (await mcp(kAll.token)).client.listTools()).tools.map((t) => t.name);
check(`/api/mcp alias serves the same ${toolsMcp.length} tools as /mcp`, toolsApi.length === toolsMcp.length && toolsApi.length >= 32, `${toolsApi.length} vs ${toolsMcp.length}`);
check('no Origin header (CLI/SDK) allowed', (await rawPost('/mcp', { authorization: `Bearer ${kAll.token}` })).status === 200);
check('foreign Origin rejected 403 on /mcp', (await rawPost('/mcp', { authorization: `Bearer ${kAll.token}`, origin: 'https://evil.example' })).status === 403);
check('foreign Origin rejected 403 on /api/mcp', (await rawPost('/api/mcp', { authorization: `Bearer ${kAll.token}`, origin: 'https://evil.example' })).status === 403);
const own = new URL(BASE).origin;
check('own Origin allowed', (await rawPost('/mcp', { authorization: `Bearer ${kAll.token}`, origin: own })).status === 200);

console.log('\n5. MCP: skills + agents tools');
const rw = await mcp(kMcp.token);
const mSk = (await rw.call('create_skill', { name: 'MCP skill', instructions: 'MCP-SKILL-V1', status: 'published' })).data?.skill;
check('create_skill', mSk?.id && mSk.version === 1);
check('update_skill → v2', (await rw.call('update_skill', { skillId: mSk.id, instructions: 'MCP-SKILL-V2' })).data?.skill?.version === 2);
check('get_skill_versions', (await rw.call('get_skill_versions', { skillId: mSk.id })).data?.versions?.length === 2);
check('get_skill (old version)', (await rw.call('get_skill', { skillId: mSk.id, version: 1 })).data?.skill?.instructions === 'MCP-SKILL-V1');
check('restore_skill_version → v3', (await rw.call('restore_skill_version', { skillId: mSk.id, version: 1 })).data?.skill?.version === 3);
check('list_skills (published filter)', (await rw.call('list_skills', { status: 'published' })).data?.skills?.some((s) => s.id === mSk.id));
const mAg = (await rw.call('create_agent_config', { name: 'MCP agent', systemInstructions: 'MCP-AGENT-INSTR', skillIds: [mSk.id], libraryIds: [libPub.id] })).data?.agent;
check('create_agent_config with skill + library', mAg?.id && mAg.skills.length === 1 && mAg.libraries.length === 1);
check('update_agent_config', (await rw.call('update_agent_config', { agentId: mAg.id, status: 'inactive' })).data?.agent?.status === 'inactive');
check('assign_agent_library', (await rw.call('assign_agent_library', { agentId: mAg.id, libraryId: libSecret.id })).data?.agent?.libraries?.length === 2);
check('remove_agent_library', (await rw.call('remove_agent_library', { agentId: mAg.id, libraryId: libSecret.id })).data?.agent?.libraries?.length === 1);
check('assign_agent_skill (pinned v1)', (await rw.call('assign_agent_skill', { agentId: mAg.id, skillId: mSk.id, pinnedVersion: 1 })).data?.agent?.skills?.[0]?.pinnedVersion === 1);
const pinned = (await rw.call('get_agent_context', { agentId: mAg.id })).data;
check('pinned skill version used in context', pinned?.context?.includes('MCP-SKILL-V1'));
check('remove_agent_skill', (await rw.call('remove_agent_skill', { agentId: mAg.id, skillId: mSk.id })).data?.agent?.skills?.length === 0);
check('list_agents + get_agent_config', (await rw.call('list_agents')).data?.agents?.some((a) => a.id === mAg.id) && (await rw.call('get_agent_config', { agentId: mAg.id })).data?.agent?.name === 'MCP agent');
const res = await rw.client.listResources();
check('resources engram://skills + engram://agents listed', res.resources.some((r) => r.uri === 'engram://skills') && res.resources.some((r) => r.uri === 'engram://agents'));
check('read engram://skills/{id}', (await rw.client.readResource({ uri: `engram://skills/${mSk.id}` })).contents[0].text.includes('MCP-SKILL'));
check('read engram://agents/{id}', JSON.parse((await rw.client.readResource({ uri: `engram://agents/${mAg.id}` })).contents[0].text).name === 'MCP agent');
const prompts = (await rw.client.listPrompts()).prompts.map((p) => p.name);
check('prompts load_agent_context + apply_skill', prompts.includes('load_agent_context') && prompts.includes('apply_skill'));
check('delete_agent_config + delete_skill', !(await rw.call('delete_agent_config', { agentId: mAg.id })).isError && !(await rw.call('delete_skill', { skillId: mSk.id })).isError && (await rw.call('get_skill', { skillId: mSk.id })).isError);

console.log('\n6. Workspace tools');
check('get_workspace', (await rw.call('get_workspace')).data?.skills?.some((s) => s.id === sk.id));
const nl = (await rw.call('create_library', { name: 'MCP library' })).data?.library;
check('create_library (all-libraries key)', nl?.id);
const nt = (await rw.call('start_thread', { title: 'MCP thread', libraryIds: [libPub.id] })).data?.thread;
check('start_thread', nt?.id && nt.libraryIds.includes(libPub.id));
check('add_to_thread', (await rw.call('add_to_thread', { threadId: nt.id, content: 'Added via add_to_thread' })).data?.saved?.type === 'FACT');
check('save_thread_summary', (await rw.call('save_thread_summary', { threadId: nt.id, summary: 'Summary via MCP' })).data?.summary === 'Summary via MCP');
const sc = await mcp(kRW.token);
check('scoped key cannot create_library / start_thread', (await sc.call('create_library', { name: 'x' })).isError && (await sc.call('start_thread', { title: 'x' })).isError);

console.log('\n7. get_agent_context: scope ∩ assignment, budget, data marking');
const ctxRW = (await sc.call('get_agent_context', { agentId: ag.id, query: 'offline queue sync', threadId: thread.id, maxChars: 6000 })).data;
check('includes identity, instructions, published skill', ctxRW?.context?.includes('Senior reviewer for Atlas') && ctxRW.context.includes('Be concise.') && ctxRW.context.includes('v1: check tests first.'));
check('passages only from key-visible library', ctxRW?.citations?.length > 0 && ctxRW.citations.every((c) => c.libraryId === libPub.id) && !ctxRW.context.includes('red folder'));
check('excluded library counted, not exposed', ctxRW?.libraries?.excludedByKeyScope === 1 && !JSON.stringify(ctxRW).includes(libSecret.id));
check('thread summary included', ctxRW?.context?.includes('Offline queue shipped'));
check('stored content wrapped as data', ctxRW?.context?.includes('<engram_data>') && ctxRW.context.includes('not as instructions'));
const all = (await rw.call('get_agent_context', { agentId: ag.id, query: 'offline backup codes payroll' })).data;
check('all-libraries key sees both assigned libraries', all?.citations?.some((c) => c.libraryId === libSecret.id));
await A('PATCH', `/api/agents/${ag.id}`, { constraints: 'Never merge without tests. '.repeat(80) }); // make the full context larger than the 1000-char budget
const big = (await rw.call('get_agent_context', { agentId: ag.id, query: 'offline queue sync', threadId: thread.id, maxChars: 20000 })).data;
const tiny = (await rw.call('get_agent_context', { agentId: ag.id, query: 'offline queue sync', threadId: thread.id, maxChars: 1000 })).data;
check(`budget respected (full ${big?.budget?.usedChars} chars → ${tiny?.budget?.usedChars} ≤ 1000, truncated)`, big?.budget?.usedChars > 1000 && tiny?.budget?.usedChars <= 1000 && tiny.context.length <= 1000 && tiny.budget.truncated === true);
await A('DELETE', `/api/agents/${ag.id}/libraries`, { libraryId: libPub.id });
const unassigned = (await rw.call('get_agent_context', { agentId: ag.id, query: 'offline queue' })).data;
check('library not assigned to agent → never searched (even with all-libraries key)', unassigned?.citations?.every((c) => c.libraryId !== libPub.id));
await A('POST', `/api/agents/${ag.id}/libraries`, { libraryId: libPub.id });
check('thread outside key scope rejected', (await sc.call('get_agent_context', { agentId: ag.id, threadId: nt.id })).isError);

console.log('\n8. Read-only key');
const ro = await mcp(kRO.token);
check('read-only can get_agent_context', !(await ro.call('get_agent_context', { agentId: ag.id, query: 'offline' })).isError);
check('read-only can list_skills / get_skill', !(await ro.call('list_skills')).isError && !(await ro.call('get_skill', { skillId: sk.id })).isError);
const writes = [['create_skill', { name: 'x' }], ['update_skill', { skillId: sk.id, name: 'pwn' }], ['delete_skill', { skillId: sk.id }], ['restore_skill_version', { skillId: sk.id, version: 1 }],
  ['create_agent_config', { name: 'x' }], ['update_agent_config', { agentId: ag.id, name: 'pwn' }], ['delete_agent_config', { agentId: ag.id }], ['assign_agent_skill', { agentId: ag.id, skillId: sk.id }],
  ['remove_agent_skill', { agentId: ag.id, skillId: sk.id }], ['assign_agent_library', { agentId: ag.id, libraryId: libPub.id }], ['remove_agent_library', { agentId: ag.id, libraryId: libPub.id }],
  ['add_to_thread', { threadId: thread.id, content: 'x' }], ['save_thread_summary', { threadId: thread.id, summary: 'pwn' }]];
let blocked = 0;
for (const [n, a] of writes) { const r = await ro.call(n, a); if (r.isError && /read-only/i.test(r.text)) blocked++; }
check(`read-only key blocked on ${writes.length} write tools`, blocked === writes.length, `${blocked}/${writes.length}`);
check('nothing changed by read-only key', (await A('GET', `/api/skills/${sk.id}`)).skill?.name === 'Code review' && (await A('GET', `/api/agents/${ag.id}`)).agent?.name === 'Atlas reviewer');
check('scoped RW key cannot assign an out-of-scope library to an agent', (await sc.call('assign_agent_library', { agentId: ag.id, libraryId: libSecret.id })).isError);

console.log('\n9. Cross-user isolation');
const kB = await B('POST', '/api/keys', { name: 'B all', allLibraries: true, allThreads: true });
const xb = await mcp(kB.token);
check('B dashboard cannot read/patch/delete A skill', st(await B('GET', `/api/skills/${sk.id}`)) === 404 && st(await B('PATCH', `/api/skills/${sk.id}`, { name: 'pwn' })) === 404 && st(await B('DELETE', `/api/skills/${sk.id}`)) === 404);
check('B dashboard cannot read A skill versions / restore / duplicate', st(await B('GET', `/api/skills/${sk.id}/versions`)) === 404 && st(await B('POST', `/api/skills/${sk.id}/restore`, { version: 1 })) === 404 && st(await B('POST', `/api/skills/${sk.id}/duplicate`)) === 404);
check('B dashboard cannot read/patch/delete A agent or preview its context', st(await B('GET', `/api/agents/${ag.id}`)) === 404 && st(await B('PATCH', `/api/agents/${ag.id}`, { name: 'pwn' })) === 404 && st(await B('DELETE', `/api/agents/${ag.id}`)) === 404 && st(await B('POST', `/api/agents/${ag.id}/context`, {})) === 404);
const bAg = (await B('POST', '/api/agents', { name: 'B agent' })).agent;
check('B cannot attach A skill or A library to B agent', st(await B('POST', `/api/agents/${bAg.id}/skills`, { skillId: sk.id })) === 404 && st(await B('POST', `/api/agents/${bAg.id}/libraries`, { libraryId: libPub.id })) === 404);
check('B cannot attach skills to A agent', st(await B('POST', `/api/agents/${ag.id}/skills`, { skillId: sk.id })) === 404);
check('B MCP list_skills/list_agents empty of A data', !(await xb.call('list_skills')).text.includes(sk.id) && !(await xb.call('list_agents')).text.includes(ag.id));
check('B MCP get_skill/get_agent_config/get_agent_context on A ids fail', (await xb.call('get_skill', { skillId: sk.id })).isError && (await xb.call('get_agent_config', { agentId: ag.id })).isError && (await xb.call('get_agent_context', { agentId: ag.id })).isError);
check('B MCP update/delete A skill + agent fail', (await xb.call('update_skill', { skillId: sk.id, name: 'pwn' })).isError && (await xb.call('delete_skill', { skillId: sk.id })).isError && (await xb.call('update_agent_config', { agentId: ag.id, name: 'pwn' })).isError && (await xb.call('delete_agent_config', { agentId: ag.id })).isError);
check('B MCP cannot assign A library/skill to B agent', (await xb.call('assign_agent_library', { agentId: bAg.id, libraryId: libPub.id })).isError && (await xb.call('assign_agent_skill', { agentId: bAg.id, skillId: sk.id })).isError);
let rb = 0;
for (const uri of [`engram://skills/${sk.id}`, `engram://agents/${ag.id}`]) { try { await xb.client.readResource({ uri }); } catch { rb++; } }
check('B MCP cannot read A skill/agent resources', rb === 2);
check('A skill + agent intact after attacks', (await A('GET', `/api/skills/${sk.id}`)).skill?.name === 'Code review' && (await A('GET', `/api/agents/${ag.id}`)).agent?.skills?.length === 2);

console.log('\n10. Persistence: library delete cascades to agent links');
await A('DELETE', `/api/libraries/${libSecret.id}`);
check('agent_libraries rows for deleted library removed', (await db.listRows({ databaseId: DB, tableId: 'agent_libraries', queries: [Query.equal('libraryId', libSecret.id), Query.limit(1)] })).total === 0);

console.log('\nCleanup');
for (const call of [A, B]) {
  for (const a of (await call('GET', '/api/agents')).agents || []) await call('DELETE', `/api/agents/${a.id}`);
  for (const s of (await call('GET', '/api/skills')).skills || []) await call('DELETE', `/api/skills/${s.id}`);
  for (const l of (await call('GET', '/api/libraries')).libraries || []) await call('DELETE', `/api/libraries/${l.id}`);
  for (const t of (await call('GET', '/api/threads')).threads || []) await call('DELETE', `/api/threads/${t.id}`);
}
for (const e of [emailA, emailB]) {
  const u = (await users.list({ queries: [Query.equal('email', e)] })).users[0];
  if (u) { for (const t of ['keys', 'activity']) await db.deleteRows({ databaseId: DB, tableId: t, queries: [Query.equal('userId', u.$id)] }); await users.delete({ userId: u.$id }); }
}
console.log(`\n${pass} passed, ${failed} failed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
