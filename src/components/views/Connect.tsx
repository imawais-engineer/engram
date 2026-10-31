"use client";
import { useState } from "react";
import { api, Badge, Btn, Card, Code, CopyBtn, Empty, ErrorNote, Field, Modal, PageHeader, Skeleton, Spinner, timeAgo, useLoad } from "../ui";
import { LibraryPicker } from "./Threads";

type Key = { id: string; name: string; prefix: string; allLibraries: boolean; libraryIds: string[]; allThreads: boolean; threadIds: string[]; canWrite: boolean; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null; createdAt: string; status: string };
type Lib = { id: string; name: string; icon: string };
type Thread = { id: string; title: string };
type Activity = { id: string; keyName: string; action: string; detail: string; status: string; createdAt: string };

// Only rendered client-side after a user action (inside a modal), so reading window here is safe.
const useOrigin = () => (typeof window === "undefined" ? "" : window.location.origin);

export function snippets(url: string, token: string) {
  return [
    { id: "cursor", label: "Cursor", file: "~/.cursor/mcp.json", note: "Format from Cursor’s MCP docs; not yet tested against Engram.", code: JSON.stringify({ mcpServers: { engram: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2) },
    { id: "claude-code", label: "Claude Code", file: "terminal", note: "Tested: Claude Code 2.1.316 reports ✔ Connected.", code: `claude mcp add --transport http engram ${url} \\\n  --header "Authorization: Bearer ${token}"` },
    { id: "vscode", label: "VS Code", file: ".vscode/mcp.json", note: "Format from VS Code’s MCP docs; not yet tested against Engram.", code: JSON.stringify({ servers: { engram: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2) },
    { id: "claude-desktop", label: "Claude Desktop", file: "claude_desktop_config.json", note: "Uses the community mcp-remote bridge; not tested against Engram.", code: JSON.stringify({ mcpServers: { engram: { command: "npx", args: ["-y", "mcp-remote", url, "--header", "Authorization:${AUTH_HEADER}"], env: { AUTH_HEADER: `Bearer ${token}` } } } }, null, 2) },
    { id: "curl", label: "curl", file: "Streamable HTTP, stateless JSON responses", note: "Tested, along with MCP Inspector CLI and the TypeScript and Python MCP SDKs.", code: `curl -s ${url} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` },
  ];
}

async function testConnection(url: string, token: string) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  const t0 = performance.now();
  const init = await fetch(url, { method: "POST", headers: h, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "engram-dashboard-test", version: "1.0.0" } } }) });
  if (!init.ok) throw new Error(`initialize failed: HTTP ${init.status} ${(await init.json().catch(() => ({})))?.error?.message ?? ""}`);
  const info = await init.json();
  const list = await fetch(url, { method: "POST", headers: { ...h, "Mcp-Protocol-Version": info.result.protocolVersion }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) });
  const tools = (await list.json()).result?.tools ?? [];
  const libs = await fetch(url, { method: "POST", headers: { ...h, "Mcp-Protocol-Version": info.result.protocolVersion }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_libraries", arguments: {} } }) });
  const libText = (await libs.json()).result?.content?.[0]?.text ?? "{}";
  return { server: `${info.result.serverInfo.name} ${info.result.serverInfo.version}`, protocol: info.result.protocolVersion, tools: tools.map((t: { name: string }) => t.name), libraries: (JSON.parse(libText).libraries ?? []).map((l: { name: string }) => l.name), ms: Math.round(performance.now() - t0) };
}

export function ConnectPanel({ token, keyName }: { token: string; keyName: string }) {
  const origin = useOrigin();
  const url = `${origin}/mcp`;
  const list = snippets(url, token);
  const [tab, setTab] = useState(list[0].id);
  const [test, setTest] = useState<Awaited<ReturnType<typeof testConnection>> | null>(null);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState("");
  const s = list.find((x) => x.id === tab)!;
  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="mb-2 text-sm font-medium text-amber-200">Copy your key for “{keyName}” now. It won’t be shown again.</div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-black/60 px-3 py-2 font-mono text-[13px] text-white">{token}</code>
          <CopyBtn text={token} />
        </div>
        <p className="mt-2 text-xs text-amber-200/70">Engram stores only a peppered HMAC-SHA256 hash of this key.</p>
      </div>
      <div className="mb-2 flex items-center justify-between text-sm"><span className="text-zinc-400">MCP endpoint</span><span className="font-mono text-zinc-200">{url}</span></div>
      <div className="mb-3 mt-4 flex flex-wrap gap-1">
        {list.map((x) => <button key={x.id} onClick={() => setTab(x.id)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === x.id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{x.label}</button>)}
      </div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">{s.file} · {s.note}</span>
        <CopyBtn text={s.code} label="Copy config" />
      </div>
      <Code>{s.code}</Code>
      <div className="mt-5 flex items-center gap-3">
        <Btn variant="outline" disabled={testing} onClick={async () => { setTesting(true); setErr(""); try { setTest(await testConnection(url, token)); } catch (e) { setErr((e as Error).message); } setTesting(false); }}>{testing ? "Testing…" : "Test connection"}</Btn>
        {testing && <Spinner />}
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
      {test && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="font-medium">✓ Connected to {test.server} · protocol {test.protocol} · {test.ms} ms</div>
          <div className="mt-1 text-emerald-200/80">{test.tools.length} tools: {test.tools.join(", ")}</div>
          <div className="mt-1 text-emerald-200/80">Libraries visible to this key: {test.libraries.join(", ") || "none"}</div>
        </div>
      )}
    </div>
  );
}

export default function ConnectView() {
  const keys = useLoad<{ keys: Key[] }>("/api/keys");
  const libs = useLoad<{ libraries: Lib[] }>("/api/libraries");
  const threads = useLoad<{ threads: Thread[] }>("/api/threads");
  const act = useLoad<{ activity: Activity[] }>("/api/activity?limit=25");
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<{ token: string; name: string } | null>(null);
  const libName = new Map((libs.data?.libraries ?? []).map((l) => [l.id, l.name]));
  const threadName = new Map((threads.data?.threads ?? []).map((t) => [t.id, t.title]));
  const reloadAll = () => { keys.reload(); act.reload(); };

  async function revoke(k: Key) {
    if (!confirm(`Revoke "${k.name}"? Any AI tool using it is disconnected immediately.`)) return;
    await api(`/api/keys/${k.id}/revoke`, { method: "POST" });
    reloadAll();
  }
  async function rotate(k: Key) {
    if (!confirm(`Rotate "${k.name}"? The old key stops working now and you'll get a new one with the same scope.`)) return;
    const r = await api<{ token: string; key: Key }>(`/api/keys/${k.id}/rotate`, { method: "POST" });
    setIssued({ token: r.token, name: r.key.name });
    reloadAll();
  }
  async function remove(k: Key) {
    if (!confirm(`Delete "${k.name}" permanently?`)) return;
    await api(`/api/keys/${k.id}`, { method: "DELETE" });
    reloadAll();
  }

  return (
    <div className="fade-up">
      <PageHeader title="Connect" subtitle="One MCP endpoint for your AI tools. Give each tool its own scoped key so you can see what it did and revoke it without breaking the others." action={<Btn onClick={() => setOpen(true)}>+ New key</Btn>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <ErrorNote error={keys.error} />
          {!keys.data && !keys.error && <Skeleton rows={2} />}
          {keys.data && !keys.data.keys.length && <Empty icon="🔑" title="No keys yet" body="Create a key and add the endpoint to an MCP client such as Claude Code. Your libraries and threads become available there." action={<Btn onClick={() => setOpen(true)}>Create your first key</Btn>} />}
          <div className="space-y-3">
            {keys.data?.keys.map((k) => (
              <Card key={k.id} className={`p-4 ${k.status !== "active" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{k.name}</span>
                  <Badge tone={k.status === "active" ? "green" : k.status === "expired" ? "amber" : "red"}>{k.status}</Badge>
                  <Badge tone={k.canWrite ? "violet" : "zinc"}>{k.canWrite ? "read + write" : "read-only"}</Badge>
                  <span className="mono-app text-lilac">{k.prefix}…</span>
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  <span className="text-zinc-500">Libraries:</span> {k.allLibraries ? "all" : k.libraryIds.map((id) => libName.get(id) ?? "deleted").join(", ") || "none"}
                  <span className="mx-2 text-zinc-700">·</span>
                  <span className="text-zinc-500">Threads:</span> {k.allThreads ? "all" : k.threadIds.map((id) => threadName.get(id) ?? "deleted").join(", ") || "none"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 mono-app text-zinc-500">
                  <span>Created {timeAgo(k.createdAt)}</span>
                  <span>Last used {timeAgo(k.lastUsedAt)}</span>
                  <span>{k.expiresAt ? `Expires ${new Date(k.expiresAt).toLocaleDateString()}` : "Never expires"}</span>
                  <span className="ml-auto flex gap-3">
                    {k.status === "active" && <button onClick={() => rotate(k)} className="hover:text-zinc-200">Rotate</button>}
                    {k.status === "active" && <button onClick={() => revoke(k)} className="hover:text-red-300">Revoke</button>}
                    {k.status !== "active" && <button onClick={() => remove(k)} className="hover:text-red-300">Delete</button>}
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-6 p-5">
            <div className="mono-app mb-2 text-lilac">How it works</div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-400">
              <li>Each key is a bearer token (<span className="font-mono text-zinc-300">engram_…</span>), scoped to chosen libraries and threads, with an expiry. Only a peppered HMAC-SHA256 hash is stored. Older <span className="font-mono text-zinc-300">eng_…</span> keys keep working.</li>
              <li>Your AI tool calls <span className="font-mono text-zinc-300">/mcp</span> (MCP Streamable HTTP). Engram checks the key hash, scope, expiry and revocation on every request.</li>
              <li>32 tools across memory (libraries, threads, memories), skills (versioned instructions) and agents (get_agent_context). Also served at <span className="font-mono text-zinc-300">/api/mcp</span>.</li>
              <li>A memory saved through one key is immediately visible through every other key that can see that thread.</li>
            </ol>
          </Card>
        </section>
        <aside>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><span className="mono-app text-lilac">Recent activity</span><button onClick={act.reload} className="mono-app text-lilac hover:text-cream">Refresh</button></div>
            {!act.data && <Spinner />}
            {act.data && !act.data.activity.length && <p className="text-sm text-zinc-600">Nothing yet. Tool calls from your AI tools show up here.</p>}
            <div className="space-y-2.5">
              {act.data?.activity.map((a) => (
                <div key={a.id} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${a.status === "ok" ? "bg-emerald-400" : a.status === "denied" ? "bg-red-400" : "bg-amber-400"}`} />
                    <span className="font-mono text-zinc-300">{a.action.replace(/^tool\./, "")}</span>
                    <span className="mono-app ml-auto text-zinc-500">{timeAgo(a.createdAt)}</span>
                  </div>
                  <div className="truncate pl-3 text-zinc-500">{a.keyName}{a.detail ? ` · ${a.detail}` : ""}</div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New key">
        <KeyForm libs={libs.data?.libraries ?? []} threads={threads.data?.threads ?? []} onDone={(token, name) => { setOpen(false); setIssued({ token, name }); reloadAll(); }} />
      </Modal>
      <Modal open={!!issued} onClose={() => setIssued(null)} title="Connect your AI tool" wide>
        {issued && <ConnectPanel token={issued.token} keyName={issued.name} />}
      </Modal>
    </div>
  );
}

function KeyForm({ libs, threads, onDone }: { libs: Lib[]; threads: Thread[]; onDone: (token: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [allLibraries, setAllLibraries] = useState(false);
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [allThreads, setAllThreads] = useState(false);
  const [threadIds, setThreadIds] = useState<string[]>([]);
  const [canWrite, setCanWrite] = useState(true);
  const [expiresInDays, setExpires] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await api<{ token: string; key: Key }>("/api/keys", { body: { name, allLibraries, libraryIds, allThreads, threadIds, canWrite, expiresInDays } });
      onDone(r.token, r.key.name);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const threadAsLibs = threads.map((t) => ({ id: t.id, name: t.title, icon: "🧵" }));
  return (
    <form onSubmit={submit}>
      <Field label="Name" hint="Name it after the tool, so activity reads “Cursor saved a decision”."><input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Cursor on my laptop" /></Field>
      <Field label="Libraries">
        <label className="mb-2 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={allLibraries} onChange={(e) => setAllLibraries(e.target.checked)} /> All libraries, including future ones</label>
        {!allLibraries && <LibraryPicker libs={libs} value={libraryIds} onChange={setLibraryIds} />}
      </Field>
      <Field label="Threads">
        <label className="mb-2 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={allThreads} onChange={(e) => setAllThreads(e.target.checked)} /> All threads, including future ones</label>
        {!allThreads && <LibraryPicker libs={threadAsLibs} value={threadIds} onChange={setThreadIds} />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Permission">
          <select className="input" value={canWrite ? "rw" : "r"} onChange={(e) => setCanWrite(e.target.value === "rw")}><option value="rw">Read + write memories</option><option value="r">Read-only</option></select>
        </Field>
        <Field label="Expires">
          <select className="input" value={expiresInDays} onChange={(e) => setExpires(Number(e.target.value))}><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={0}>Never</option></select>
        </Field>
      </div>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end"><Btn type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</Btn></div>
    </form>
  );
}
