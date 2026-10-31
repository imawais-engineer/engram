// Protocol-level compatibility checks for the MCP endpoint (no data written).
// Usage: BASE=https://engram-ai.appwrite.network ENGRAM_KEY=engram_... node scripts/compat-check.mjs
const BASE = process.env.BASE || 'http://localhost:3000', KEY = process.env.ENGRAM_KEY;
let pass = 0, failed = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n); } else { failed++; console.log('  ✗', n, x); } };
const post = (path, headers, body) => fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
const init = (v) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v, capabilities: {}, clientInfo: { name: 'compat', version: '1' } } });
console.log('Engram MCP compatibility checks against', BASE);
for (const p of ['/mcp', '/api/mcp']) {
  for (const v of ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']) {
    const r = await post(p, { authorization: `Bearer ${KEY}` }, init(v)); const j = await r.json();
    check(`${p} initialize ${v} negotiates ${v}`, r.status === 200 && j.result?.protocolVersion === v, `${r.status}`);
  }
  const tl = await post(p, { authorization: `Bearer ${KEY}` }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }); const tj = await tl.json();
  check(`${p} stateless tools/list without initialize`, tl.status === 200 && tj.result?.tools?.length >= 32);
  const na = await post(p, {}, { jsonrpc: '2.0', id: 2, method: 'tools/list' }); const naj = await na.json();
  check(`${p} missing key → 401 + WWW-Authenticate Bearer + JSON-RPC error`, na.status === 401 && /^Bearer realm="engram"/.test(na.headers.get('www-authenticate') || '') && naj.error?.code === -32001);
  const bad = await post(p, { authorization: 'Bearer engram_invalid' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  check(`${p} bad key → 401 error="invalid_token"`, bad.status === 401 && /invalid_token/.test(bad.headers.get('www-authenticate') || ''));
  const g = await fetch(BASE + p, { headers: { authorization: `Bearer ${KEY}`, accept: 'text/event-stream' } });
  check(`${p} GET (no standalone SSE stream) → 405`, g.status === 405);
}
for (const w of ['oauth-protected-resource', 'oauth-protected-resource/mcp', 'oauth-authorization-server', 'openid-configuration']) {
  const r = await fetch(`${BASE}/.well-known/${w}`); const ct = r.headers.get('content-type') || ''; const j = await r.json().catch(() => null);
  check(`/.well-known/${w} → JSON 404`, r.status === 404 && ct.includes('application/json') && j?.error === 'not_found', `${r.status} ${ct}`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
