import "server-only";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateToken, logActivity, rateLimit } from "@/lib/keys";
import { buildServer } from "@/lib/mcp/server";
import { originAllowed } from "@/lib/mcp/origin";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

function corsFor(req: Request) {
  const origin = req.headers.get("origin");
  return origin ? { ...CORS, "Access-Control-Allow-Origin": origin, Vary: "Origin" } : CORS;
}

function rpcError(status: number, code: number, message: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status, headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

export async function handleMcp(req: Request) {
  // Spec: servers must validate Origin to stop DNS-rebinding / cross-site calls. Clients that send no Origin (CLIs, SDKs) are fine.
  if (!originAllowed(req)) return rpcError(403, -32003, "Origin not allowed");
  const header = req.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return rpcError(401, -32001, "Missing Authorization: Bearer <engram key>", { "WWW-Authenticate": 'Bearer realm="engram"' });
  const key = await authenticateToken(token);
  if (!key) return rpcError(401, -32001, "Invalid, expired or revoked Engram key", { "WWW-Authenticate": 'Bearer realm="engram", error="invalid_token"' });
  const rl = rateLimit(key.id);
  if (!rl.ok) {
    await logActivity(key.userId, { keyId: key.id, keyName: key.name, action: "rate_limited", status: "denied" });
    return rpcError(429, -32002, "Rate limit exceeded (60 requests/minute)", { "Retry-After": String(rl.retryAfter) });
  }
  if (req.method !== "POST") return rpcError(405, -32000, "Method not allowed: this server is stateless, use POST", { Allow: "POST, OPTIONS" });

  // Stateless: a fresh server + transport per request, so it scales on serverless.
  const server = buildServer(key);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsFor(req))) headers.set(k, v);
    const body = await res.text();
    return new Response(body, { status: res.status, headers });
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export function handleOptions(req: Request) {
  if (!originAllowed(req)) return rpcError(403, -32003, "Origin not allowed");
  return new Response(null, { status: 204, headers: corsFor(req) });
}
