// Seeds a rich demo workspace: 4 libraries with indexed docs, 3 threads with typed memories, 7 skills (6 published,
// 1 draft, several with 2+ versions), 3 agents with assigned skills and libraries, and two MCP keys
// (one read-write for Claude Code, one read-only for the Python client).
// Usage:
//   BASE=https://engram-ai.appwrite.network DEMO_EMAIL=demo@engram-demo.app DEMO_PASSWORD='<password>' \
//   APPWRITE_API_KEY=... RESET=1 node scripts/seed-demo.mjs
// RESET=1 first deletes the existing account with that email (scripts/delete-user.mjs), so re-running is safe.
// Writes DEMO_ACCOUNT.txt (gitignored) with the login, both keys and the ids.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.BASE || 'http://localhost:3000';
const email = process.env.DEMO_EMAIL || `demo+${Date.now()}@engram.app`;
const WORDS = ['orbit', 'cedar', 'lantern', 'harbor', 'violet', 'comet', 'maple', 'river', 'summit', 'falcon', 'ember', 'quartz', 'meadow', 'nova', 'atlas', 'pixel'];
const password = process.env.DEMO_PASSWORD || [0, 1, 2, 3].map(() => WORDS[randomInt(WORDS.length)]).join('-') + '-' + randomInt(1000, 9999);
if (process.env.RESET === '1') execFileSync('node', ['scripts/delete-user.mjs', email], { stdio: 'inherit' });

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

// ---------- Libraries ----------
const lib = async (name, icon, description) => (await call('POST', '/api/libraries', { name, icon, description })).library;
const atlas = await lib('Project Atlas', '🚀', 'Requirements, architecture and standup notes for the Atlas courier-tracking MVP.');
const handbook = await lib('Engineering handbook', '🛠️', 'Team coding conventions, review and release rules.');
const roadmap = await lib('Product roadmap', '🗺️', 'Now / Next / Later roadmap, success metrics and risks for Atlas.');
const research = await lib('Research notes', '🔬', 'SMS gateway comparison, rider interviews and competitor scan.');
for (const [l, file, mime] of [[atlas, 'docs/sample/atlas-architecture.pdf', 'application/pdf'], [atlas, 'docs/sample/standup-notes.md', 'text/markdown'],
  [handbook, 'docs/sample/engineering-handbook.md', 'text/markdown'], [roadmap, 'docs/sample/product-roadmap.md', 'text/markdown'], [research, 'docs/sample/research-notes.md', 'text/markdown']]) {
  const d = (await up(l.id, file, mime)).document; console.log('doc', d.title, d.status, d.chunkCount);
}

// ---------- Threads ----------
const thr = async (t) => (await call('POST', '/api/threads', t)).thread;
const thread = await thr({ title: 'Atlas MVP build', description: 'Shipping the courier-tracking MVP before the Eid rush',
  instructions: 'Use TypeScript and the engineering handbook rules. Keep MVP scope tight: no card payments, no route optimiser. Treat DECISION memories as settled unless the user reopens them.',
  summary: 'Rider app offline queue works; dispatcher live map is on Appwrite Realtime. Open: SMS gateway choice, photo compression.', libraryIds: [atlas.id, handbook.id] });
const planning = await thr({ title: 'Q4 roadmap planning', description: 'Turning the Atlas roadmap into a dated plan for Q4',
  instructions: 'Plan in Now / Next / Later. Every item needs an owner, a size (S/M/L) and a success metric. Do not move v2 items into the MVP.',
  summary: 'MVP scope is frozen. v1.1 candidates: offline photo queue, Urdu UI, daily COD report. Waiting on SMS gateway decision.', libraryIds: [roadmap.id, research.id, atlas.id] });
const sms = await thr({ title: 'Research: SMS gateway', description: 'Choosing an SMS gateway for Pakistani numbers',
  instructions: 'Compare on price per message, delivery reports, sender ID registration time and docs quality. Recommend one option.',
  summary: 'Two gateways shortlisted (A cheaper, B real-time reports). Sender ID registration takes 1–2 weeks for both.', libraryIds: [research.id] });
const mem = (t, type, content, tags) => call('POST', `/api/threads/${t.id}/memories`, { type, content, tags });
await mem(thread, 'PREFERENCE', 'Explain trade-offs briefly, then recommend one option.', ['style']);
await mem(planning, 'INSTRUCTION', 'Roadmap items use the format: title, owner, size (S/M/L), metric, target month.', ['format']);
await mem(sms, 'FACT', 'Gateway B charges more per message but sends real-time delivery reports through a webhook.', ['sms']);

// ---------- MCP keys ----------
const rw = await call('POST', '/api/keys', { name: 'Claude Code (read-write)', allLibraries: true, allThreads: true, canWrite: true, expiresInDays: 30 });
const ro = await call('POST', '/api/keys', { name: 'Python client (read-only)', allLibraries: true, allThreads: true, canWrite: false, expiresInDays: 30 });
async function mcp(token) {
  const c = new McpClient({ name: 'seed', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return async (name, args) => { const r = await c.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${name}: ${r.content?.[0]?.text}`); return r; };
}
const a = await mcp(rw.token);
const save = (t, type, content, tags) => a('save_memory', { threadId: t.id, type, content, tags });
await a('search_library', { query: 'how do live rider locations update?' });
await save(thread, 'DECISION', 'Live rider locations use Appwrite Realtime pushes every 15 seconds; no polling.', ['architecture']);
await save(thread, 'FACT', 'Proof-of-delivery photos are stored in Appwrite Storage and compressed to 1280px on device.', ['storage']);
await save(thread, 'TASK', 'Compare two SMS gateways for Pakistani numbers (cost per message, delivery reports) and pick one.', ['sms']);
await save(thread, 'PROJECT_STATE', 'COD reconciliation screen drafted; totals check against cod_ledger at shift end. Next: offline photo upload queue.', ['cod']);
await save(thread, 'DECISION', 'Route optimiser is out of MVP scope; dispatchers assign parcels manually until v2.', ['scope']);
await save(planning, 'DECISION', 'v1.1 ships the offline photo upload queue first, then the Urdu rider UI.', ['v1.1']);
await save(planning, 'TASK', 'Draft the v1.1 release notes once the offline photo queue is merged.', ['release']);
await save(planning, 'TASK', 'Set up a weekly COD mismatch report to track the 0.5% target.', ['metrics']);
await save(planning, 'FACT', 'Success metric: dispatcher assigns a parcel in under 20 seconds.', ['metrics']);
await save(sms, 'TASK', 'Send 200 test messages through each gateway and record delivery rates by network.', ['sms']);
await save(sms, 'PROJECT_STATE', 'Sender ID registration started with both gateways on 30 Oct.', ['sms']);
await a('save_thread_summary', { threadId: planning.id, summary: 'MVP scope frozen. v1.1 order decided: offline photo queue, then Urdu UI. Open: COD report owner, SMS gateway.' });

// ---------- Skills ----------
const skill = async (s) => (await call('POST', '/api/skills', s)).skill;
const edit = (s, instructions, changeSummary) => call('PATCH', `/api/skills/${s.id}`, { instructions, changeSummary });
const ROADMAP_V1 = `## Goal\nTurn a product goal into a Now / Next / Later roadmap.\n\n## Steps\n1. Restate the goal and the user it serves in one sentence.\n2. List candidate items from the roadmap library and thread memories.\n3. Place each item in Now, Next or Later.\n\n## Output\nA table: item, bucket, owner.`;
const ROADMAP_V2 = `## Goal\nTurn a product goal into a Now / Next / Later roadmap that a team can act on.\n\n## Steps\n1. Restate the goal and the user it serves in one sentence.\n2. Pull candidate items from the Product roadmap library and thread DECISION memories. Settled decisions are not reopened.\n3. Place each item in Now, Next or Later. Now = needed for the current release; Later = v2 or unproven.\n4. Give each item an owner, a size (S/M/L) and one success metric.\n5. Flag dependencies and the top 3 risks.\n\n## Output\n- A table: item | bucket | owner | size | metric | target month.\n- A short "Risks and dependencies" list.\n- One sentence: what to cut first if time runs short.\n\n## Rules\n- Never move v2 items (route optimiser, card payments) into Now.\n- Cite the library passage you used as [title #chunk].`;
const pr = await skill({ name: 'Project Roadmap planner', category: 'product', tags: ['roadmap', 'planning'], description: 'Builds a Now / Next / Later roadmap with owners, sizes and metrics.', instructions: ROADMAP_V1, status: 'published' });
await edit(pr, ROADMAP_V2, 'Add owners, sizes, metrics, risks and v2 guard');
const REVIEW_V1 = '## Order\n1. Run the tests first and report failures before anything else.\n2. Check every new API route for auth and per-user ownership.\n3. Flag scope creep against the MVP rules (no card payments, no route optimiser).\n\n## Output\nBullets, most important first.';
const REVIEW_V2 = '## Order\n1. Run the tests first and report failures before anything else.\n2. Check every new API route for auth and per-user ownership.\n3. Flag scope creep against the MVP rules (no card payments, no route optimiser).\n4. Check offline behaviour: anything a rider does must survive a dropped connection.\n5. Check secrets: no API keys in client code or logs.\n\n## Output\n- Blocking issues first, then suggestions.\n- Each bullet: file, problem, fix.\n- End with "Approve" or "Request changes".';
const review = await skill({ name: 'Atlas code review', category: 'engineering', tags: ['review', 'typescript'], description: 'How Atlas pull requests are reviewed.', instructions: REVIEW_V1, status: 'published' });
await edit(review, REVIEW_V2, 'Add offline and secrets checks; verdict line');
const notes = await skill({ name: 'Release notes writer', category: 'writing', tags: ['release'], status: 'published', description: 'Turns merged PRs into user-facing release notes.',
  instructions: '## Input\nA list of merged pull requests or a thread of TASK and DECISION memories.\n\n## Steps\n1. Group changes by user impact: New, Improved, Fixed.\n2. Rewrite each in plain language for riders, dispatchers or courier owners.\n3. Drop internal-only changes (refactors, CI).\n\n## Output\n- A title with the version and date.\n- Three short sections, at most 5 bullets each.\n- No internal ticket ids or code names.' });
const meeting = await skill({ name: 'Meeting summary', category: 'productivity', tags: ['meetings', 'notes'], status: 'published', description: 'Summarises a meeting or standup into decisions, tasks and open questions.',
  instructions: '## Steps\n1. Read the notes or transcript once fully.\n2. Extract decisions, tasks (with owner and due date) and open questions.\n3. Offer to save each decision and task to the Engram thread with save_memory.\n\n## Output\n**Decisions** — one line each.\n**Tasks** — owner: task (due).\n**Open questions** — who needs to answer.\n**Summary** — at most 3 sentences.' });
const BUG_V1 = '## Steps\n1. Reproduce the bug from the report.\n2. Assign a severity.\n\n## Output\nSeverity and next step.';
const BUG_V2 = '## Steps\n1. Restate the bug: expected vs actual, who is affected.\n2. Reproduce it, or list what is missing to reproduce it.\n3. Assign severity: S1 data loss or cash mismatch, S2 blocks deliveries, S3 workaround exists, S4 cosmetic.\n4. Suggest the likely component (rider app, dispatcher dashboard, SMS, COD).\n\n## Output\n- Severity, component, owner suggestion.\n- Reproduction steps.\n- One-line fix hypothesis.\n\n## Rules\n- Any COD mismatch is at least S1.';
const bug = await skill({ name: 'Bug triage', category: 'engineering', tags: ['bugs', 'qa'], description: 'Triages a bug report into severity, component and next step.', instructions: BUG_V1, status: 'published' });
await edit(bug, BUG_V2, 'Define severities, component and COD rule');
const sql = await skill({ name: 'SQL & data analysis helper', category: 'data', tags: ['sql', 'analytics'], status: 'published', description: 'Writes and explains SQL for Atlas metrics such as COD mismatch and delivery rates.',
  instructions: '## Steps\n1. Restate the question as a metric with a time window.\n2. Name the tables and columns you assume (e.g. cod_ledger, parcels, riders). Ask if unsure.\n3. Write one readable SQL query with CTEs and comments.\n4. Explain how to read the result and one sanity check.\n\n## Output\n- The SQL in a code block.\n- A 3-bullet explanation.\n\n## Rules\n- Read-only queries only: never UPDATE or DELETE.\n- Round money to 2 decimals and show percentages with one decimal.' });
const support = await skill({ name: 'Customer support reply', category: 'support', tags: ['support'], description: 'Draft: replies to courier customers about delayed parcels.',
  instructions: '## Steps\n1. Apologise once, plainly.\n2. Give the parcel status and next update time.\n\n## Output\nUnder 80 words, Urdu or English to match the customer.' });

// ---------- Agents ----------
const agent = async (x) => (await call('POST', '/api/agents', x)).agent;
const atlasAgent = await agent({ name: 'Atlas reviewer', description: 'Reviews Atlas pull requests', identity: 'A senior TypeScript reviewer who knows the Atlas courier-tracking codebase.',
  purpose: 'Review Atlas changes against the MVP scope and the engineering handbook.', systemInstructions: 'Be concise. Cite the library passage you rely on as [title #chunk]. Ask before suggesting new dependencies.',
  responseStyle: 'Short bullets, most important first.', constraints: 'Never approve changes that add card payments or a route optimiser to the MVP.', preferredClient: 'Claude Code',
  skillIds: [review.id, bug.id], libraryIds: [atlas.id, handbook.id] });
const plannerAgent = await agent({ name: 'Roadmap planner', description: 'Plans Atlas releases and writes release notes', identity: 'A pragmatic product manager for a small courier-tech team in Pakistan.',
  purpose: 'Turn goals, research and decisions into a dated roadmap and clear release notes.', systemInstructions: 'Use the Project Roadmap planner skill for plans and the Release notes writer skill for notes. Respect settled DECISION memories.',
  responseStyle: 'Tables first, then a short explanation.', constraints: 'Do not promise dates without an owner. Keep v2 items out of the MVP.', preferredClient: 'Claude Code',
  skillIds: [pr.id, meeting.id, notes.id], libraryIds: [roadmap.id, research.id, atlas.id] });
const researchAgent = await agent({ name: 'Research assistant', description: 'Answers questions from research notes and metrics', identity: 'A careful analyst who separates evidence from opinion.',
  purpose: 'Answer research and data questions from the Research notes and Product roadmap libraries.', systemInstructions: 'Quote the passage behind every claim. Say "not in the notes" when the libraries do not cover something.',
  responseStyle: 'Evidence bullets, then a one-line recommendation.', constraints: 'Read-only analysis. Never invent numbers.', preferredClient: 'Python client',
  skillIds: [sql.id, meeting.id], libraryIds: [research.id, roadmap.id] });

// Read-only key exercises the context path (and proves writes are refused).
const b = await mcp(ro.token);
await b('get_agent_context', { agentId: plannerAgent.id, query: 'plan v1.1', threadId: planning.id });
const denied = await b('save_memory', { threadId: planning.id, type: 'FACT', content: 'should be refused' }).then(() => false, () => true);
console.log('read-only key write refused:', denied);

writeFileSync('DEMO_ACCOUNT.txt', `Engram demo account (do not commit)
URL: ${BASE}
Email: ${email}
Password: ${password}

Threads: Atlas MVP build (${thread.id}), Q4 roadmap planning (${planning.id}), Research: SMS gateway (${sms.id})
Libraries: Project Atlas (${atlas.id}), Engineering handbook (${handbook.id}), Product roadmap (${roadmap.id}), Research notes (${research.id})
Agents: Atlas reviewer (${atlasAgent.id}), Roadmap planner (${plannerAgent.id}), Research assistant (${researchAgent.id})
Skills: Project Roadmap planner (${pr.id}, published v2), Atlas code review (${review.id}, published v2), Release notes writer (${notes.id}, published),
        Meeting summary (${meeting.id}, published), Bug triage (${bug.id}, published v2), SQL & data analysis helper (${sql.id}, published),
        Customer support reply (${support.id}, draft)

MCP endpoint: ${BASE}/mcp   (alias ${BASE}/api/mcp)
Key A, Claude Code (read-write, all libraries + threads, 30 days): ${rw.token}
Key B, Python client (read-only, all libraries + threads, 30 days): ${ro.token}

Created ${new Date().toISOString()}
`);
console.log('seeded', email);
