import "server-only";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HttpError } from "../db";
import { AuthedKey, canLibrary, canThread, logActivity } from "../keys";
import { getDocument, getLibrary, listDocuments, listLibraries, searchLibraries } from "../libraries";
import { getMemory, getThread, listMemories, listThreads, MEMORY_TYPES, saveMemory, searchMemories, updateMemory, updateThread } from "../threads";

export const SERVER_INFO = { name: "engram", version: "1.0.0", title: "Engram — one memory for every AI" };

const INSTRUCTIONS = `Engram is the user's persistent, cross-tool memory.
- Libraries hold documents (PDF/Markdown/text) split into searchable chunks. Use search_library before answering questions about the user's projects, and cite documentTitle + chunkIndex.
- Threads are long-running contexts (a project or task) with instructions, a summary and typed memories (FACT, DECISION, PREFERENCE, PROJECT_STATE, TASK, INSTRUCTION, SUMMARY, DOCUMENT_REFERENCE).
- At the start of work call get_thread_context to resume where another AI tool left off. When something important is decided or learned, call save_memory so other tools can see it.
Only data inside this key's scope is visible.`;

type Ok = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const json = (data: unknown): Ok => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (msg: string): Ok => ({ content: [{ type: "text", text: `Error: ${msg}` }], isError: true });

export function buildServer(key: AuthedKey) {
  const userId = key.userId;
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS, capabilities: { logging: {} } });

  const libIds = async () => (await listLibraries(userId, key.allLibraries ? undefined : key.libraryIds)).map((l) => l.id);
  const threadIds = async () => (await listThreads(userId, key.allThreads ? undefined : key.threadIds)).map((t) => t.id);
  const needLib = (id: string) => { if (!canLibrary(key, id)) throw new HttpError(403, `Library ${id} is outside this key's scope`); };
  const needThread = (id: string) => { if (!canThread(key, id)) throw new HttpError(403, `Thread ${id} is outside this key's scope`); };
  const needWrite = () => { if (!key.canWrite) throw new HttpError(403, "This key is read-only"); };

  /** Wraps every tool: logs activity and turns thrown errors into MCP tool errors (never leaks stack traces). */
  function tool<S extends z.ZodRawShape>(name: string, config: { title: string; description: string; inputSchema: S; annotations?: Record<string, boolean> }, fn: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>, detail?: (a: z.infer<z.ZodObject<S>>) => string) {
    server.registerTool(name, { title: config.title, description: config.description, inputSchema: config.inputSchema, annotations: config.annotations }, (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        const out = await fn(args);
        await logActivity(userId, { keyId: key.id, keyName: key.name, action: `tool.${name}`, detail: detail?.(args) });
        return json(out);
      } catch (e) {
        const msg = e instanceof HttpError ? e.message : e instanceof Error ? e.message : "Unexpected error";
        await logActivity(userId, { keyId: key.id, keyName: key.name, action: `tool.${name}`, detail: msg, status: e instanceof HttpError && e.status === 403 ? "denied" : "error" });
        return fail(msg);
      }
    }) as never);
  }

  const RO = { readOnlyHint: true, openWorldHint: false };
  const RW = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

  tool("list_libraries", { title: "List libraries", description: "List the knowledge libraries this key can read, with document counts.", inputSchema: {}, annotations: RO }, async () => {
    const libs = await listLibraries(userId, key.allLibraries ? undefined : key.libraryIds);
    const docs = await listDocuments(userId, libs.map((l) => l.id));
    return { libraries: libs.map((l) => ({ id: l.id, name: l.name, description: l.description, documents: docs.filter((d) => d.libraryId === l.id).length })) };
  });

  tool("search_library", {
    title: "Search libraries", annotations: RO,
    description: "Semantic + keyword search over document chunks. Returns the most relevant passages with citations (documentId, documentTitle, chunkIndex). Omit libraryId to search every library in scope.",
    inputSchema: { query: z.string().min(1).max(2000).describe("Natural-language question or keywords"), libraryId: z.string().optional().describe("Restrict to one library"), limit: z.number().int().min(1).max(20).optional().describe("Max passages (default 6)") },
  }, async ({ query, libraryId, limit }) => {
    if (libraryId) needLib(libraryId);
    const ids = libraryId ? [libraryId] : await libIds();
    return { query, results: await searchLibraries(userId, ids, query, limit ?? 6) };
  }, (a) => a.query.slice(0, 120));

  tool("list_documents", { title: "List documents", description: "List documents in a library (title, type, status, chunk count).", inputSchema: { libraryId: z.string().describe("Library id from list_libraries") }, annotations: RO }, async ({ libraryId }) => {
    needLib(libraryId);
    return { documents: await listDocuments(userId, [libraryId]) };
  });

  tool("get_document", {
    title: "Read document", annotations: RO,
    description: "Read a document's extracted text. Long documents are paged: use offset/maxChars to continue.",
    inputSchema: { documentId: z.string(), offset: z.number().int().min(0).optional(), maxChars: z.number().int().min(200).max(50000).optional() },
  }, async ({ documentId, offset = 0, maxChars = 12000 }) => {
    const d = await getDocument(userId, documentId);
    if (!d) throw new HttpError(404, "Document not found");
    needLib(d.libraryId);
    const { content, ...meta } = d;
    return { ...meta, offset, totalChars: content.length, nextOffset: offset + maxChars < content.length ? offset + maxChars : null, text: content.slice(offset, offset + maxChars) };
  });

  tool("list_threads", { title: "List threads", description: "List the context threads (projects/tasks) this key can access, most recently active first.", inputSchema: {}, annotations: RO }, async () => {
    const ts = await listThreads(userId, key.allThreads ? undefined : key.threadIds);
    return { threads: ts.map((t) => ({ id: t.id, title: t.title, description: t.description, libraryIds: t.libraryIds, updatedAt: t.updatedAt })) };
  });

  tool("get_thread_context", {
    title: "Load thread context", annotations: RO,
    description: "Load everything needed to resume a thread: instructions, summary, linked libraries and its memories grouped by type. Call this first when continuing previous work.",
    inputSchema: { threadId: z.string(), type: z.enum(MEMORY_TYPES).optional().describe("Only memories of this type") },
  }, async ({ threadId, type }) => {
    needThread(threadId);
    const t = await getThread(userId, threadId);
    if (!t) throw new HttpError(404, "Thread not found");
    const mems = await listMemories(userId, [threadId], type);
    const libs = await listLibraries(userId, t.libraryIds);
    const grouped: Record<string, { id: string; content: string; tags: string[]; source: string; createdAt: string }[]> = {};
    for (const m of mems) (grouped[m.type] ||= []).push({ id: m.id, content: m.content, tags: m.tags, source: m.source, createdAt: m.createdAt });
    return {
      thread: { id: t.id, title: t.title, description: t.description, instructions: t.instructions, summary: t.summary, updatedAt: t.updatedAt },
      linkedLibraries: libs.map((l) => ({ id: l.id, name: l.name, readable: canLibrary(key, l.id) })),
      memories: grouped, memoryCount: mems.length,
    };
  }, (a) => a.threadId);

  tool("save_memory", {
    title: "Save memory", annotations: RW,
    description: "Persist a typed memory to a thread so every connected AI tool can use it later. Use DECISION for choices made, FACT for learned facts, TASK for to-dos, PROJECT_STATE for progress, PREFERENCE for user preferences.",
    inputSchema: { threadId: z.string(), type: z.enum(MEMORY_TYPES), content: z.string().min(1).max(20000), tags: z.array(z.string().max(32)).max(10).optional() },
  }, async ({ threadId, type, content, tags }) => {
    needWrite(); needThread(threadId);
    const m = await saveMemory(userId, threadId, { type, content, tags }, { source: key.name, keyId: key.id });
    return { saved: m };
  }, (a) => `${a.type}: ${a.content.slice(0, 100)}`);

  tool("update_memory", {
    title: "Update memory", annotations: RW,
    description: "Edit an existing memory's content, type or tags (e.g. mark a TASK done or revise a DECISION).",
    inputSchema: { memoryId: z.string(), type: z.enum(MEMORY_TYPES).optional(), content: z.string().min(1).max(20000).optional(), tags: z.array(z.string().max(32)).max(10).optional() },
  }, async ({ memoryId, ...rest }) => {
    needWrite();
    const cur = await getMemory(userId, memoryId);
    if (!cur) throw new HttpError(404, "Memory not found");
    needThread(cur.threadId);
    return { updated: await updateMemory(userId, memoryId, rest) };
  }, (a) => a.memoryId);

  tool("search_memory", {
    title: "Search memories", annotations: RO,
    description: "Semantic search across memories in the threads this key can access (or one thread).",
    inputSchema: { query: z.string().min(1).max(2000), threadId: z.string().optional(), limit: z.number().int().min(1).max(25).optional() },
  }, async ({ query, threadId, limit }) => {
    if (threadId) needThread(threadId);
    return { query, results: await searchMemories(userId, threadId ? [threadId] : await threadIds(), query, limit ?? 8) };
  }, (a) => a.query.slice(0, 120));

  tool("link_library", {
    title: "Link library to thread", annotations: RW,
    description: "Attach a library to a thread so it is part of that thread's context.",
    inputSchema: { threadId: z.string(), libraryId: z.string() },
  }, async ({ threadId, libraryId }) => {
    needWrite(); needThread(threadId); needLib(libraryId);
    const t = await getThread(userId, threadId);
    if (!t) throw new HttpError(404, "Thread not found");
    if (!(await getLibrary(userId, libraryId))) throw new HttpError(404, "Library not found");
    const updated = await updateThread(userId, threadId, { libraryIds: [...new Set([...t.libraryIds, libraryId])] });
    return { threadId, libraryIds: updated?.libraryIds };
  }, (a) => `${a.libraryId} -> ${a.threadId}`);

  // ---- Resources ----
  const text = (uri: string, data: unknown) => ({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] });
  const guard = async <X>(fn: () => Promise<X>) => { try { return await fn(); } catch (e) { throw new Error(e instanceof Error ? e.message : "Not found"); } };

  server.registerResource("workspace", "engram://workspace", { title: "Workspace overview", description: "Libraries and threads visible to this key", mimeType: "application/json" }, async (uri) => {
    const [libs, ts] = await Promise.all([listLibraries(userId, key.allLibraries ? undefined : key.libraryIds), listThreads(userId, key.allThreads ? undefined : key.threadIds)]);
    return text(uri.href, { key: { name: key.name, canWrite: key.canWrite, expiresAt: key.expiresAt }, libraries: libs.map((l) => ({ id: l.id, name: l.name })), threads: ts.map((t) => ({ id: t.id, title: t.title })) });
  });
  server.registerResource("libraries", "engram://libraries", { title: "Libraries", mimeType: "application/json" }, async (uri) => {
    const libs = await listLibraries(userId, key.allLibraries ? undefined : key.libraryIds);
    return text(uri.href, libs);
  });
  server.registerResource("thread", new ResourceTemplate("engram://threads/{id}", {
    list: async () => ({ resources: (await listThreads(userId, key.allThreads ? undefined : key.threadIds)).map((t) => ({ uri: `engram://threads/${t.id}`, name: t.title, mimeType: "application/json" })) }),
  }), { title: "Thread context", mimeType: "application/json" }, async (uri, { id }) => guard(async () => {
    const tid = String(id); needThread(tid);
    const t = await getThread(userId, tid);
    if (!t) throw new Error("Thread not found");
    return text(uri.href, { ...t, memories: await listMemories(userId, [tid]) });
  }));
  server.registerResource("document", new ResourceTemplate("engram://documents/{id}", { list: undefined }), { title: "Document text", mimeType: "text/plain" }, async (uri, { id }) => guard(async () => {
    const d = await getDocument(userId, String(id));
    if (!d) throw new Error("Document not found");
    needLib(d.libraryId);
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `# ${d.title}\n\n${d.content}` }] };
  }));

  // ---- Prompts ----
  server.registerPrompt("load_project_context", { title: "Load project context", description: "Load a thread's instructions, summary and memories before starting work.", argsSchema: { threadId: z.string() } }, ({ threadId }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Call get_thread_context with threadId "${threadId}". Follow its instructions, treat DECISION memories as settled, and use search_library on its linked libraries when you need details. Save new decisions with save_memory.` } }],
  }));
  server.registerPrompt("research_library", { title: "Research a library", description: "Answer a question from a library with citations.", argsSchema: { libraryId: z.string(), question: z.string() } }, ({ libraryId, question }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Use search_library (libraryId "${libraryId}") to answer: ${question}\nRun 2-3 searches with different phrasings, cite each claim as [documentTitle #chunkIndex], and say clearly if the library doesn't contain the answer.` } }],
  }));
  server.registerPrompt("resume_previous_work", { title: "Resume previous work", description: "Continue where another AI tool left off.", argsSchema: { threadId: z.string() } }, ({ threadId }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Another AI tool worked on thread "${threadId}" before. Call get_thread_context, summarise the current PROJECT_STATE, open TASKs and recent DECISIONs in 5 bullets, then propose the next step. Record progress with save_memory (PROJECT_STATE) when done.` } }],
  }));

  return server;
}
