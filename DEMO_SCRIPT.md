# Engram: 2-minute demo script

**Title:** One memory. Two AI tools. Zero context loss.

Before recording, run `scripts/seed-demo.mjs` against production (or use the account in `DEMO_ACCOUNT.txt`), and keep two
terminals ready, each with a different key from that file. Engram has been tested with Claude Code, MCP Inspector and the
TypeScript and Python MCP SDKs, so use two of those.

**0:00–0:15 · Problem** (landing page)
"Every AI tool forgets. What you decided with one assistant is gone when you open another. Engram is one memory layer you own,
built on Appwrite, that any MCP client you connect can read and write."

**0:15–0:40 · Libraries** (Libraries → Project Atlas)
Drop the Atlas architecture PDF. "It goes to Appwrite Storage. The text is chunked, embedded with Appwrite Embeddings, and
stored in TablesDB." Search *"what happens when riders lose network?"* and point at the cited passage.

**0:40–1:00 · Threads** (Threads → Atlas MVP build)
"A thread holds a project's instructions, summary and typed memories: decisions, facts, tasks. Note the badges: *via Claude Code*,
*via Cursor*. Different tools wrote these."

**1:00–1:35 · Two tools, one memory** (terminals)
Tool A (Claude Code with key 1): *"Search my Atlas library for the SMS gateway question and save a DECISION: use gateway X, batch hourly."*
(This needs a signed-in Claude Code session. Without one, run `save_memory` through MCP Inspector CLI.)
Tool B (Inspector or the Python client with key 2): `get_thread_context` shows the new DECISION, saved through a different key.
Refresh the thread page in the dashboard, where it appears live.

**1:35–1:55 · Control** (Connect)
"Each tool gets its own key, scoped to specific libraries and threads, with an expiry. Only the SHA-256 hash is stored. The
activity log shows every tool call." Revoke key 2, then run it again to show the 401.

**1:55–2:00 · Close**
"Engram: one memory for every AI. Built on Appwrite Auth, TablesDB, Storage and Embeddings."

---

**Submission blurb:**
Engram is a portable memory layer for AI tools, built on Appwrite. Libraries hold your documents, which are chunked and
embedded with Appwrite Embeddings and stored in TablesDB. Threads hold typed project memories such as decisions, facts and
tasks. One stateless MCP endpoint, protected by scoped and revocable bearer keys, lets each AI client search your context and
save to it, so a decision made in one tool is available in the next. It is built on Appwrite Auth, TablesDB (7 tables,
owner-only rows), Storage and Embeddings, and the vector store sits behind an interface so VectorsDB can replace it on a paid plan.
