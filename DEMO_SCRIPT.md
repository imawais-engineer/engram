# Engram: 2-minute demo script

**Title:** Your AI subscription, supercharged. One memory. Every skill. Every AI.

**Setup before recording**
- Seed the demo: `BASE=https://engram-ai.appwrite.network DEMO_EMAIL=demo@engram-demo.app DEMO_PASSWORD='<password>' RESET=1 node scripts/seed-demo.mjs`
  (needs `APPWRITE_API_KEY` for the reset). It creates 4 libraries, 3 threads, 7 skills (6 published, 1 draft), 3 agents and
  two keys, and writes `DEMO_ACCOUNT.txt` (gitignored) with the login, key A (read-write), key B (read-only) and all ids.
- **Client 1, Claude Code** (signed in), with key A:
  `claude mcp add --transport http engram https://engram-ai.appwrite.network/mcp --header "Authorization: Bearer <key A>"`.
  Check with `claude mcp list`, which should show ✔ Connected.
- **Client 2, the Python MCP SDK client**, with key B:
  `TOKEN=<key B> THREAD=<thread id> AGENT=<agent id> python3 scripts/mcp-python-client.py`.
  Key B is read-only, so the script's `save_memory` is refused: that shows the scope check. Everything else it reads works.

**Live test prompts:** the landing page section "Connect your AI in 60 seconds" and the Connect page have a copyable
setup prompt, a "Connected? Test it" prompt with what you should see, and an @Engram command cheatsheet.

**0:00–0:15 · Problem** (landing page)
"Every AI tool forgets. You re-explain your project, your rules and your style in every chat. Engram is one memory you own,
built on Appwrite, that every MCP client you connect reads and writes. Less repetition, more productivity."

**0:15–0:35 · Memory** (Libraries → Project Atlas, then Threads → Atlas MVP build)
Search *"what happens when riders lose network?"* and point at the cited passage. On the thread: "Decisions, facts and tasks,
saved by an AI tool through its own key: *via Claude Code (read-write)*."

**0:35–0:55 · Skills** (Skills → Atlas code review)
"A skill is a reusable instruction pack. This one is published at v2. Here's the history, and I can restore v1." Point at
the draft skill: "Drafts never reach an agent."

**0:55–1:15 · Agent config** (Agents → Atlas reviewer)
"An agent bundles identity, instructions, skills and the libraries it may read." Type *review the offline status updates* and
click **Preview**: "This is exactly what an AI receives: the published skill, the thread summary, cited passages, inside a size
budget. Stored content is marked as data, not instructions."

**1:15–1:45 · Two clients, one memory**
- Claude Code: *"Load my Engram agent Atlas reviewer for the Atlas MVP build thread, then save a DECISION: use gateway X for SMS, batched hourly."*
  It calls `get_agent_context`, then `save_memory`.
- Python client (key B): run the script. It prints the agent context it received (same agent, same skills) and
  the DECISION Claude Code just saved. Refresh the thread page: the new DECISION shows *via Claude Code (read-write)*.

**1:45–1:55 · Control** (Connect)
"Each tool has its own key, scoped to libraries and threads, read-only or read-write, with an expiry. Only a peppered HMAC hash is
stored, browser Origins are checked, and every tool call is logged." Revoke key B, run the Python client again: 401.

**1:55–2:00 · Close**
"Engram: one memory, every skill, every AI. Built on Appwrite Auth, TablesDB, Storage, Embeddings and Sites."

---

**Submission blurb:**
Engram is a memory layer for the AI tools you already pay for, built on Appwrite. Libraries hold your documents, chunked and
embedded with Appwrite Embeddings and stored in TablesDB. Threads hold typed project memories. Skills are versioned instruction packs,
and Agents bundle identity, instructions, skills and allowed libraries. One stateless MCP endpoint exposes 32 tools, including
`get_agent_context`, which composes an agent's full setup within a character budget and never goes beyond the calling key's scope.
It is protected by scoped, revocable, HMAC-hashed bearer keys. Built on Appwrite Auth, TablesDB (12 tables, owner-only rows),
Storage, Embeddings and Sites.
