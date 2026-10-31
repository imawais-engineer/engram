# Engram: your AI subscription, supercharged

**Less repetition. More productivity. One memory. Every skill. Every AI.**

Engram is a memory layer that you own, built on **Appwrite**. You keep your documents, project decisions, reusable **skills**
and saved **agent** setups in one place. Any MCP client you connect, such as Claude Code, MCP Inspector or your own agent, can
read that context and add to it through **one key-protected MCP endpoint**.

**Live (Appwrite Sites):** https://engram-ai.appwrite.network · **MCP endpoint:** `https://engram-ai.appwrite.network/mcp`

> Built for the Appwrite Databases Hackathon (Oct 2026). Built with Appwrite **TablesDB**, Auth, Storage and Embeddings.

![Overview](docs/screenshots/02-overview.png)

## The problem

Each AI tool keeps its own memory. Decisions made in one chat are gone in the next tool, so you end up explaining your
project again every time. Engram keeps that context in one place, and every tool you connect reads from it.

**One memory. Two AI tools. Zero context loss.** If Claude Code saves a `DECISION` through one key, a second client using its
own key sees it right away through `get_thread_context`.

## Concepts

| Term | What it is |
| --- | --- |
| **Workspace** | Your account (Appwrite Auth). Every row in every table belongs to exactly one workspace. |
| **Library** | A collection of documents (PDF, Markdown, TXT, pasted text). Each document is split into chunks of about 900 characters and embedded. |
| **Thread** | Long-running context for a project or task: instructions, a summary, linked libraries and typed **memories**. |
| **Memory** | A typed entry: `FACT`, `DECISION`, `PREFERENCE`, `PROJECT_STATE`, `TASK`, `INSTRUCTION`, `SUMMARY` or `DOCUMENT_REFERENCE`. |
| **Skill** | A reusable instruction pack (e.g. a code-review checklist). Draft or published, with full version history and restore. Only published skills reach agents. |
| **Agent** | A saved setup: identity, purpose, instructions, response style, constraints, assigned skills and the libraries it may read. `get_agent_context` hands it to any AI. |
| **Key** | An MCP bearer token (`engram_…`) scoped to chosen libraries and threads. It is read-only or read and write, can expire and can be revoked. Older `eng_…` keys still work. |

## Architecture

```
 MCP clients (Claude Code, Inspector, SDKs, …)       Browser dashboard
            │  POST /mcp or /api/mcp (Bearer engram_…)    │ httpOnly Appwrite session cookie
            ▼                                             ▼
 ┌──────────────────────── Next.js 16 on Appwrite Sites ────────────────────────┐
 │  /mcp  stateless Streamable HTTP (MCP TS SDK 1.32)    /api/*  route handlers │
 │   └ Origin check → key auth → scope → tool → log       └ requireUser()       │
 │   lib/: libraries · threads · skills · agents · agent-context · keys         │
 │   core/stores.ts (interfaces) ← infrastructure/appwrite-tables.ts (adapter)  │
 └───────────────────────────────┬──────────────────────────────────────────────┘
                                 │ node-appwrite (server API key, server-side only)
   Appwrite Cloud:  Auth · TablesDB (1 database, 12 tables) · Storage (1 bucket) · Embeddings (nomic-embed-text, 768-d)
```

**TablesDB tables** (all in database `notemind`; `scripts/setup-appwrite.mjs` creates them and is safe to run more than once):

| Table | Key columns | Indexes |
| --- | --- | --- |
| `libraries` | userId, name, description, icon | userId+$createdAt |
| `documents` | userId, libraryId, title, sourceType, mimeType, fileId, size, status (`uploaded/processing/indexed/failed`), error, chunkCount, content (mediumtext) | userId, libraryId |
| `chunks` | userId, libraryId, documentId, index, text, **embedding (longtext JSON, 768 floats)**, model | libraryId, documentId, userId |
| `threads` | userId, title, description, instructions, summary, libraryIds[] | userId+$updatedAt |
| `memories` | userId, threadId, type, content, tags[], embedding, source (key name), keyId | threadId+$createdAt, userId |
| `keys` | userId, name, **tokenHash (unique)**, hashVersion (`hmac-sha256-v2`, or empty for legacy SHA-256), prefix, allLibraries, libraryIds[], allThreads, threadIds[], canWrite, expiresAt, revokedAt, lastUsedAt | tokenHash (unique), userId |
| `activity` | userId, keyId, keyName, action, detail, status (`ok/denied/error`) | userId+$createdAt, keyId |
| `skills` | userId, name, description, category, tags[], status (`draft/published`), currentVersion, instructions (mediumtext), compatibility | userId+$updatedAt, userId+status |
| `skill_versions` | userId, skillId, version, name, description, instructions, changeSummary | skillId+version, userId |
| `agents` | userId, name, description, identity, purpose, systemInstructions, responseStyle, constraints, preferredClient, status (`active/inactive`), version | userId+$updatedAt, userId+status |
| `agent_skills` | userId, agentId, skillId, pinnedVersion (empty = current published) | agentId, skillId, **unique(agentId, skillId)** |
| `agent_libraries` | userId, agentId, libraryId, access | agentId, libraryId, **unique(agentId, libraryId)** |

Original files are stored in the Storage bucket `documents` with owner-only file permissions. Deleting a document also deletes
its chunks (bulk `deleteRows`) and its file. Deleting a library deletes all of its documents and its agent assignments. Deleting
a skill deletes its versions and agent assignments; deleting an agent deletes its assignments (the skills and libraries stay).
Relationship tables hold plain ids rather than Appwrite relationship columns, so the schema stays portable.

**Storage seam:** `src/core/stores.ts` declares `LibraryStore`, `ThreadStore`, `SkillStore`, `AgentStore`, `KeyStore` and
`VectorStore`. The only implementation is `src/infrastructure/appwrite-tables.ts`, a thin adapter over the domain functions in
`src/lib`. Its capability note is honest: no native vector search, no full-text index, no transactions, no relationship columns.

### Retrieval

`src/lib/vector-store.ts` defines a small `VectorStore` interface (`upsert`, `search`, `deleteByDocument`). The MCP server and the
UI depend only on that interface. The current implementation, `TablesDBVectorStore`, stores each chunk's vector as a JSON
string in a longtext column. At query time it embeds the query with Appwrite Embeddings (using `search_query:`/`search_document:`
prefixes, which nomic needs) and ranks chunks from the allowed libraries using **85% cosine similarity + 15% keyword overlap**.
Each result comes back with its `documentTitle` and `chunkIndex` as a citation.

### VectorsDB vs TablesDB: why the adapter exists

Appwrite **VectorsDB** is the natural home for these vectors, and I tried to make it Engram's only database. Two attempts on
this Free-plan project (Appwrite Cloud, sfo, 31 Oct 2026):

1. With the TablesDB database still present, `vectorsDB.create()` returned
   `403 The maximum number of databases allowed for the selected plan has reached. Upgrade to increase the limit.`
2. After deleting the TablesDB database so the one-database slot was free, it returned
   `400 No shared vectorsdb pool is configured on this deployment. Pass a specification to create the database on a dedicated database.`
   The only specifications listed are paid dedicated instances (from $10/month), all disabled for this organisation.

So VectorsDB isn't available on the Free plan here, and I recreated the TablesDB schema with `scripts/setup-appwrite.mjs`.
A `VectorsDBVectorStore` can be added behind the same interface when a dedicated VectorsDB is available, with no changes
to the MCP server or UI. Brute-force ranking works well at demo
scale (thousands of chunks). It is the first part to replace for large libraries.

### Embedding storage test (768 dims in TablesDB)

Run with `node scripts/probe-embedding-storage.mjs`. Measured on 31 Oct 2026 against Appwrite Cloud (sfo):

| Test | Result |
| --- | --- |
| nomic-embed-text output | 768 dims |
| JSON, rounded to 1e-6 (what Engram stores) | **7,204 bytes** per vector; reads back byte-identical; max abs error vs. original 5e-7 |
| JSON, full precision | 9,457 bytes; reads back byte-identical |
| Bulk `createRows` with 50 chunk rows (text + vector) | OK; all 50 parse back as 768-d vectors |

Longtext columns are stored outside the fixed row-size budget, so a 7–10 KB string per row fits with plenty of room.
Splitting a vector across columns isn't needed. On one run, a list request made immediately after a bulk insert returned
fewer rows than were written. The same check passed on the rerun, so treat reads right after a bulk write as possibly lagging.
Embedding calls take about 0.5 s per chunk and fail on batches of 64 or more, so Engram embeds in batches of 16 with 3 in parallel.

## MCP server

`POST /mcp` (and the alias `POST /api/mcp`, the same handler): Streamable HTTP, **stateless** (no `Mcp-Session-Id`; each request
builds a fresh server), JSON responses. `GET`/`DELETE` return 405.

**32 tools.** Every tool has a zod schema, a description and read-only/write/destructive annotations. Write tools fail for read-only keys.
- Memory: `get_workspace`, `list_libraries`, `create_library`, `search_library` (semantic + keyword, with citations), `list_documents`,
  `get_document` (paged), `list_threads`, `start_thread`, `get_thread_context`, `save_memory`, `add_to_thread` (alias of save_memory),
  `update_memory`, `search_memory`, `save_thread_summary`, `link_library`.
- Skills: `list_skills`, `get_skill` (any version), `create_skill`, `update_skill`, `delete_skill`, `get_skill_versions`, `restore_skill_version`.
- Agents: `list_agents`, `get_agent_config`, `create_agent_config`, `update_agent_config`, `delete_agent_config`, `assign_agent_skill`,
  `remove_agent_skill`, `assign_agent_library`, `remove_agent_library`, `get_agent_context`.

**Resources:** `engram://workspace`, `engram://libraries`, `engram://threads/{id}`, `engram://documents/{id}`, `engram://skills`,
`engram://skills/{id}`, `engram://agents`, `engram://agents/{id}`.
**Prompts:** `load_project_context`, `research_library`, `resume_previous_work`, `load_agent_context`, `apply_skill`.

### get_agent_context

`get_agent_context(agentId, query?, threadId?, maxChars = 12000)` builds one text block in priority order: a notice, the agent's
identity, its instructions, its **published** skills (a pinned version is read from history), the thread's summary and recent
memories, then library passages for `query`. Rules:
- Libraries are the **intersection** of the agent's assignments and the calling key's scope. A library outside the key's scope
  is never searched, and only a count of excluded libraries is returned, not their ids. A library not assigned to the agent is
  never searched, even with an all-libraries key.
- The thread must be in the key's scope.
- The text never exceeds `maxChars` (1,000–60,000). Sections are cut, and the response says what was truncated.
- Stored content (passages, memories) is wrapped in `<engram_data>` and labelled as reference data, not instructions.
- Read-only keys can call it. It writes nothing.

### What was actually tested

Production below means the Appwrite Sites deployment at https://engram-ai.appwrite.network, run on 31 Oct 2026 (PKT):

- `scripts/acceptance.mjs`: **71/71** passed. Memory core: accounts, libraries, PDF indexing, search, threads, keys, MCP, cross-user isolation, revoke/rotate, cascade.
- `scripts/acceptance-v2.mjs`: **78/78** passed. Covers:
  - Skills CRUD, versions, restore, duplicate and persistence across sessions.
  - Agent CRUD, relationships and cascades.
  - `get_agent_context` scope intersection, budget and data marking.
  - Read-only blocking on 13 write tools.
  - Legacy `eng_` and new HMAC `engram_` keys.
  - Origin validation, and `/mcp` and `/api/mcp` serving the same 32 tools.
  - Cross-user isolation for skills and agents.
- `scripts/compat-check.mjs`: **20/20** passed. Covers protocol versions, stateless `tools/list`, the 401 `WWW-Authenticate` shape, GET → 405 and JSON 404 on `/.well-known/oauth-*`, on both paths. Re-run with both acceptance suites after commit f69139c: 71/71 and 78/78.

### Client compatibility

Full matrix with evidence and config snippets: **[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)**. It covers 22 client and transport rows and the
protocol behaviour checks. Summary as of 31 Oct 2026 (PKT), production:

| Status | Clients |
| --- | --- |
| **Tested** (run against production) | curl; MCP TypeScript SDK 1.32.2; MCP Python SDK 1.30.0; FastMCP 4.1.4; LangChain MCP adapters 0.3.2; OpenAI Agents SDK 0.24.0; MCP Inspector CLI 2.13.0; mcp-remote 0.15.2 (stdio bridge) |
| **Tested, handshake only** (`✔ Connected`, no signed-in session for tool calls) | Claude Code 2.1.316 (`mcp add`, `add-json`, project `.mcp.json` with `${ENGRAM_KEY}`); Gemini CLI 0.66.0 |
| **Config accepted, not connected** (needs vendor login) | Codex CLI 0.166.0 |
| **Documented, not run** (GUI apps / accounts) | Cursor, VS Code, Windsurf, Zed, Claude Desktop (via mcp-remote), Perplexity, Mistral Le Chat, Grok Bot |
| **Needs OAuth** (Engram has none) | ChatGPT custom apps; claude.ai custom connectors (unless the org has the request-headers beta) |

The server negotiates `2024-11-05`, `2025-03-26`, `2025-06-18` and `2025-11-25`. It is Streamable HTTP only: the legacy
HTTP+SSE transport is not supported (GET → 405). `/.well-known/oauth-*` returns a JSON 404, so OAuth discovery fails cleanly.

### Connect a client

```bash
# Claude Code (tested)
claude mcp add --transport http engram https://engram-ai.appwrite.network/mcp --header "Authorization: Bearer engram_…"
```

```jsonc
// Cursor ~/.cursor/mcp.json (format from Cursor docs, not run; see docs/COMPATIBILITY.md)
{ "mcpServers": { "engram": { "url": "https://engram-ai.appwrite.network/mcp", "headers": { "Authorization": "Bearer engram_…" } } } }
```

## Security model

- **Keys:** 256-bit random tokens (`engram_` + base64url). The full key is shown once. Only an **HMAC-SHA256 hash keyed with a
  server-only pepper** (`ENGRAM_KEY_PEPPER`, a Sites secret variable) is stored, marked `hashVersion: hmac-sha256-v2`, and looked
  up through a unique index. A leaked database dump alone can't be used to check guesses. Older `eng_` keys (plain SHA-256,
  192-bit) keep working; the prefix decides which hash is looked up, so nothing was invalidated. The list API never returns
  the hash or the key.
- **Origin validation:** if a request to `/mcp` or `/api/mcp` carries an `Origin` header, it must be the site's own origin
  (`NEXT_PUBLIC_APP_URL`) or listed in `ENGRAM_ALLOWED_ORIGINS`, otherwise the server answers 403. Requests without `Origin`
  (CLIs, SDKs, desktop clients) are allowed, and bearer auth still applies. The `Host` header isn't trusted for this.
- **Every MCP request** checks the key's hash, then that it hasn't been revoked or expired, then the rate limit (60/min per key,
  per server instance), and then the scope for each tool. Calls outside the key's scope fail with a tool error and are logged
  as `denied`. Read-only keys can't write.
- **Ownership on every operation.** All data access runs on the server with the Appwrite API key, so the app checks
  ownership itself. `getOwned()` loads a row and rejects it unless `row.userId === caller`. Indirect lookups re-check ownership
  at every step. For example, `get_document` loads the document, checks its owner, then checks the key's scope for the
  document's libraryId. `update_memory` goes from the memory to its thread, then checks ownership and scope. `link_library`
  checks both rows. Lists of IDs (thread libraryIds, key scopes, search libraryIds) are filtered to the caller's own rows
  before they are stored or used.
  Skills, versions, agents and both assignment tables follow the same rule: assigning a skill or library to an agent checks that
  both rows belong to the caller, and the MCP `assign_agent_library` tool also requires the library to be inside the key's scope.
  Rows and files also carry owner-only Appwrite permissions (`read/update/delete: user:<id>`) as a second layer.
- **Rotate** revokes the old key and issues a new key with the same scope. Activity (tool, key, outcome) is logged per key and
  shown in the dashboard. `lastUsedAt` is updated on each use.
- **Dashboard sessions:** Appwrite email/password sessions are kept in an httpOnly, `SameSite=Strict`, Secure cookie.
- `scripts/acceptance.mjs` covers cross-user attacks: user B reuses user A's real library, document, thread, memory and key
  IDs against every dashboard route and MCP tool and resource. Every one is rejected, and A's data is checked afterwards to
  confirm nothing changed.

## Run it

```bash
npm install
cp .env.example .env.local            # fill in the project id + server API key
node --env-file=.env.local scripts/setup-appwrite.mjs   # creates the tables, indexes and bucket (safe to re-run)
npm run dev
BASE=http://localhost:3000 node --env-file=.env.local scripts/acceptance.mjs     # 71 checks: memory core
BASE=http://localhost:3000 node --env-file=.env.local scripts/acceptance-v2.mjs  # 78 checks: skills, agents, keys, Origin
BASE=http://localhost:3000 node scripts/seed-demo.mjs                          # demo workspace → DEMO_ACCOUNT.txt
```

Deploy: **Appwrite Sites**, connected to this repo's `main` branch, so every push builds and activates a deployment.
Site settings: framework `nextjs`, adapter `ssr`, build runtime `node-24`, install `npm install`, build `npm run build`,
output `./.next`, request timeout 60 s (the Sites maximum). Site variables: `NEXT_PUBLIC_APPWRITE_ENDPOINT`,
`NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APP_URL`, `APPWRITE_DATABASE_ID`, `APPWRITE_BUCKET_ID`, plus `APPWRITE_API_KEY` and
`ENGRAM_KEY_PEPPER` (both marked secret). Optional: `ENGRAM_ALLOWED_ORIGINS`.
Project: `6ae5ea70000968dca787` in Frankfurt (`https://fra.cloud.appwrite.io/v1`).

## Screenshots

| | |
| --- | --- |
| ![Landing](docs/screenshots/01-landing.png) | ![Overview](docs/screenshots/02-overview.png) |
| ![Libraries](docs/screenshots/03-libraries.png) | ![Semantic search with citations](docs/screenshots/04-library-search.png) |
| ![Thread with memories saved through two MCP keys](docs/screenshots/05-thread.png) | ![Connect](docs/screenshots/06-connect.png) |
| ![Key created + live connection test](docs/screenshots/07-connect-key-test.png) | ![Skills](docs/screenshots/11-skills.png) |
| ![Skill with version history](docs/screenshots/12-skill-versions.png) | ![Agents](docs/screenshots/13-agents.png) |
| ![Agent with get_agent_context preview](docs/screenshots/14-agent-context.png) | ![Full landing page](docs/screenshots/01b-landing-full.png) |

Mobile (390 px): [landing](docs/screenshots/10-mobile-landing.png) · [overview](docs/screenshots/09-mobile-overview.png) · [thread](docs/screenshots/08-mobile-thread.png)

**Visual language:** plum `#1F0A2E` ground, cream `#F6EFE6` text, pink `#FF4D8D` actions (dark plum text on pink, 5.9:1),
violet `#7A3FA8` surfaces, lilac `#C9A6DE` mono labels (8.8:1 on plum), panel `#250D37` bands. Space Grotesk poster headlines and
JetBrains Mono labels via `next/font`. Single column under 900 px.

## Limits and honest notes

- VectorsDB needs a paid dedicated instance on this project, so Engram uses TablesDB (see above).
- Documents are indexed inside the upload request, which Appwrite Sites caps at 60 s. There is no background queue. Each document is
  limited to 10 MB and 400 chunks.
- The rate limit is held in memory, per serverless instance. It isn't global.
- `ENGRAM_KEY_PEPPER` must be kept. If it is lost or changed, every `engram_` key stops working (legacy `eng_` keys don't depend on it).
- Agent configs keep a version counter, not a full history (skills do have full history). There is no export/import yet.
- Search is brute-force cosine in the app over every chunk in scope. That's fine at demo scale (thousands of chunks) and O(n) per query.
- Bearer keys only. There is no OAuth flow, so hosted connectors that require OAuth (e.g. claude.ai custom connectors) can't use Engram directly.

## License

MIT
