# Engram MCP client compatibility

Server: `https://engram-ai.appwrite.network/mcp` (primary) and `/api/mcp` (alias, same handler).
Transport: **Streamable HTTP, stateless** (`POST` only, JSON responses, no session id). Auth: **static bearer key**
`Authorization: Bearer engram_…` (legacy `eng_…` keys still accepted). No OAuth. 32 tools, 8 resources, 5 prompts.

All tests below were run from a Linux box on **31 Oct 2026 (PKT, UTC+5)** against production, with the seeded demo
workspace. Status meanings:

- **TESTED**: run by us against production, evidence quoted.
- **CONFIG-ONLY**: the client accepted the config, but it could not connect without a vendor login, so the handshake was not run.
- **DOCUMENTED**: config taken from the vendor's docs, not run (GUI app or requires an account).
- **NEEDS OAUTH**: the client only supports OAuth or no auth for remote servers. Engram can't be added directly.

## Matrix

| Client | Version | Transport | Auth | Status | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| curl | 8.14.1 | Streamable HTTP | Bearer header | **TESTED** | `initialize` with `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25` → 200, same version echoed, on `/mcp` and `/api/mcp`. `tools/list` without `initialize` → 200, 32 tools (stateless). |
| MCP TypeScript SDK `StreamableHTTPClientTransport` | `@modelcontextprotocol/sdk` 1.32.2 | Streamable HTTP | `requestInit.headers` | **TESTED** | Both paths: 32 tools, 8 resources, 5 prompts, `readResource engram://workspace`, `get_agent_context` (Atlas reviewer, 2,997/3,000 chars). Also used by `scripts/acceptance*.mjs`. |
| MCP TypeScript SDK `SSEClientTransport` (legacy HTTP+SSE) | 1.32.2 | HTTP+SSE (2024-11-05) | header | **Not supported** | `SSE error: Non-200 status code (405)`. Engram is Streamable HTTP only. Clients that fall back to SSE never need to, because Streamable HTTP succeeds first. |
| MCP Python SDK `streamablehttp_client` | `mcp` 1.30.0 | Streamable HTTP | `headers=` | **TESTED** | Both paths: protocol `2025-11-25`, 32 tools, 8 resources, 5 prompts, `read_resource engram://skills`, `get_prompt load_agent_context`, `list_skills`. |
| FastMCP client | `fastmcp` 4.1.4 (`mcp` 2.3.0) | Streamable HTTP | `BearerAuth(key)` | **TESTED** | Both paths: 32 tools, `get_workspace` ok. |
| LangChain MCP adapters | `langchain-mcp-adapters` 0.3.2 | `streamable_http` | `headers` | **TESTED** | `MultiServerMCPClient.get_tools()` → 32 tools; `list_libraries` invoked. No LLM call. |
| OpenAI Agents SDK `MCPServerStreamableHttp` | `openai-agents` 0.24.0 | Streamable HTTP | `params.headers` | **TESTED** | `/api/mcp`: `list_tools` → 32, `call_tool get_skill` ok. No OpenAI API call. |
| MCP Inspector CLI | `@modelcontextprotocol/inspector` 2.13.0 | `--transport http` | `--header` | **TESTED** | `/mcp` and `/api/mcp`: tools/list (32), tools/call (`list_libraries`, `list_skills`), resources/list (8), resources/read (`engram://agents`, `engram://workspace`), prompts/list (5), prompts/get (`apply_skill`, `load_agent_context`). |
| mcp-remote (stdio ↔ HTTP bridge) | 0.15.2 | stdio → Streamable HTTP | `--header "Authorization:${AUTH}"` | **TESTED** | JSON-RPC piped over stdio, both paths: log `Connected to remote server using StreamableHTTPClientTransport`; initialize → `engram 2025-06-18`; tools/list → 32; tools/call `list_agents` ok. |
| Claude Code | 2.1.316 | `http` | `--header` / `headers` | **TESTED (handshake)** | `claude mcp add --transport http` (on `/mcp`), `claude mcp add-json` (on `/api/mcp`) and project `.mcp.json` with `"Authorization": "Bearer ${ENGRAM_KEY}"` all show `✔ Connected` in `claude mcp list`. With `ENGRAM_KEY` unset, the `.mcp.json` entry fails with HTTP 401, so the variable really is expanded. A bad key shows `Server rejected the configured Authorization header (HTTP 401)`. Not signed in, so no tool call was made from inside Claude Code. |
| Gemini CLI | `@google/gemini-cli` 0.66.0 | `http` | `-H` / `headers` | **TESTED (handshake)** | `gemini mcp add -s project -t http engram …/api/mcp -H 'Authorization: Bearer $ENGRAM_KEY'` then `gemini mcp list` → `✓ engram … (http) - Connected`. It shows `Disconnected` when `ENGRAM_KEY` is unset and for a bad key. No Google login is needed for `mcp list`. A chat session needs one, and that wasn't run. |
| Codex CLI | `@openai/codex` 0.166.0 | streamable_http | `bearer_token_env_var` | **CONFIG-ONLY** | `codex mcp add engram --url …/mcp --bearer-token-env-var ENGRAM_KEY` accepted; `codex mcp list` shows `Auth: Bearer token`. `codex mcp list` doesn't connect. A real session needs an OpenAI login, which wasn't done. |
| Cursor | n/a | Streamable HTTP | `headers` + `${env:NAME}` | **DOCUMENTED** | GUI app, not installed. [Cursor MCP docs](https://cursor.com/docs/mcp) |
| VS Code (Copilot agent mode) | n/a | `http` | `headers` + `${input:…}` | **DOCUMENTED** | GUI app. [VS Code MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Windsurf (Cascade) | n/a | Streamable HTTP | `headers` + `${env:NAME}` | **DOCUMENTED** | Uses `serverUrl`, not `url`. [Windsurf Cascade MCP docs](https://docs.devin.ai/windsurf/plugins/cascade/mcp) |
| Zed | n/a | Streamable HTTP | `headers` | **DOCUMENTED** | `context_servers` with `url` and `headers`. Headers aren't env-expanded ([zed#60459](https://github.com/zed-industries/zed/issues/60459)). [Zed MCP docs](https://zed.dev/docs/ai/mcp.html) |
| Claude Desktop (local config) | n/a | stdio via mcp-remote | `--header` | **DOCUMENTED** (bridge tested) | `claude_desktop_config.json` takes stdio servers, so use mcp-remote. The bridge itself is TESTED above, the desktop app is not. |
| claude.ai / Claude Desktop custom connectors | n/a | Streamable HTTP | OAuth, or "Request headers" (beta) | **NEEDS OAUTH** (unless org has the beta) | Static `Authorization: Bearer …` request headers are a limited beta. Otherwise OAuth (DCR/CIMD) is required. [Claude remote MCP connectors](https://claude.com/docs/connectors/custom/remote-mcp), [auth types](https://claude.com/docs/connectors/building/authentication) |
| ChatGPT (developer mode apps / connectors) | n/a | Streamable HTTP / SSE | OAuth, none, or mixed | **NEEDS OAUTH** | There's no field for a static bearer header. [OpenAI developer mode guide](https://developers.openai.com/api/docs/guides/developer-mode) |
| Perplexity (custom remote connectors) | n/a | Streamable HTTP | None / API key / OAuth | **DOCUMENTED** | "API Key" mode sends `Authorization: Bearer <key>`, which matches Engram, but this hasn't been run. [Perplexity help](https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors) |
| Mistral Le Chat / Work (custom MCP connector) | n/a | Streamable HTTP | None / Bearer / OAuth 2.1 (auto-detected) | **DOCUMENTED** | Bearer token in `Authorization` is supported. Tools only, no resources or prompts yet. [Mistral MCP connectors](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors) |
| Grok Bot (custom MCP connector) | n/a | Streamable HTTP | `headers` | **DOCUMENTED** | The assistant can add a remote MCP server by URL with an `Authorization` header. This needs the account owner's approval and hasn't been run. |

## Protocol behaviour (curl, production, both paths)

| Request | Result |
| --- | --- |
| `POST` with `Accept: application/json, text/event-stream` | 200 `application/json` |
| `POST` with `Accept: application/json` only, `text/event-stream` only, or none | 406 `Not Acceptable: Client must accept both application/json and text/event-stream` (MCP SDK behaviour, spec-conformant) |
| `GET` (standalone SSE stream) | 405 + `Allow: POST, OPTIONS` (stateless server, no server-initiated stream) |
| `DELETE` (session end) | 405 (no sessions) |
| `OPTIONS` with `Origin: https://engram-ai.appwrite.network` | 204, `Access-Control-Allow-Origin` echoes the origin |
| `OPTIONS` / `POST` with `Origin: https://evil.example` | 403 `{"error":{"code":-32003,"message":"Origin not allowed"}}` |
| No `Authorization` | 401, `WWW-Authenticate: Bearer realm="engram"`, JSON-RPC error `-32001` |
| Invalid key | 401, `WWW-Authenticate: Bearer realm="engram", error="invalid_token"` |
| Key in `x-api-key` header or `?key=` | 401. Not supported on purpose: query strings leak into logs, and the MCP auth spec forbids tokens in URLs. |
| Over 60 requests/min per key | 429 + `Retry-After`. MCP Inspector reports `rate_limited … retry after Ns`. |
| `/.well-known/oauth-protected-resource`, `/oauth-authorization-server`, `/openid-configuration` | Was HTML 404. Now JSON 404 `{"error":"not_found",…}` (commit f69139c), so OAuth discovery fails cleanly instead of parsing a web page. |

Re-run the protocol checks with `BASE=… ENGRAM_KEY=engram_… node scripts/compat-check.mjs`. It writes no data.

## Config snippets (replace `engram_…` with your key; prefer an env var)

```bash
# Claude Code (TESTED)
claude mcp add --transport http engram https://engram-ai.appwrite.network/mcp --header "Authorization: Bearer $ENGRAM_KEY"
```

```json
// Claude Code project .mcp.json (TESTED; ${ENGRAM_KEY} is expanded from the environment)
{ "mcpServers": { "engram": { "type": "http", "url": "https://engram-ai.appwrite.network/mcp",
  "headers": { "Authorization": "Bearer ${ENGRAM_KEY}" } } } }
```

```bash
# Gemini CLI (TESTED handshake) → writes .gemini/settings.json
gemini mcp add -s project -t http engram https://engram-ai.appwrite.network/mcp -H 'Authorization: Bearer $ENGRAM_KEY'
```

```toml
# Codex CLI ~/.codex/config.toml (CONFIG-ONLY), or: codex mcp add engram --url … --bearer-token-env-var ENGRAM_KEY
[mcp_servers.engram]
url = "https://engram-ai.appwrite.network/mcp"
bearer_token_env_var = "ENGRAM_KEY"
```

```json
// Cursor ~/.cursor/mcp.json or .cursor/mcp.json (DOCUMENTED)
{ "mcpServers": { "engram": { "url": "https://engram-ai.appwrite.network/mcp",
  "headers": { "Authorization": "Bearer ${env:ENGRAM_KEY}" } } } }
```

```json
// VS Code .vscode/mcp.json (DOCUMENTED)
{ "inputs": [ { "type": "promptString", "id": "engram-key", "description": "Engram key", "password": true } ],
  "servers": { "engram": { "type": "http", "url": "https://engram-ai.appwrite.network/mcp",
    "headers": { "Authorization": "Bearer ${input:engram-key}" } } } }
```

```json
// Windsurf ~/.codeium/windsurf/mcp_config.json (DOCUMENTED) — note serverUrl
{ "mcpServers": { "engram": { "serverUrl": "https://engram-ai.appwrite.network/mcp",
  "headers": { "Authorization": "Bearer ${env:ENGRAM_KEY}" } } } }
```

```json
// Zed settings.json (DOCUMENTED) — headers are literal, no env expansion
{ "context_servers": { "engram": { "url": "https://engram-ai.appwrite.network/mcp",
  "headers": { "Authorization": "Bearer engram_…" } } } }
```

```json
// Claude Desktop claude_desktop_config.json via mcp-remote (bridge TESTED, app DOCUMENTED)
{ "mcpServers": { "engram": { "command": "npx",
  "args": ["-y", "mcp-remote", "https://engram-ai.appwrite.network/mcp", "--header", "Authorization:${AUTH_HEADER}"],
  "env": { "AUTH_HEADER": "Bearer engram_…" } } } }
```

```python
# Python: MCP SDK / FastMCP (TESTED)
streamablehttp_client(URL, headers={"Authorization": f"Bearer {key}"})
fastmcp.Client(URL, auth=BearerAuth(key))
```

Perplexity: Add custom connector → URL `…/mcp`, Authentication "API Key", paste the key. Mistral: Custom MCP Connector →
URL, then Bearer token. claude.ai: Add custom connector → "No sign in" → Request headers `authorization: Bearer engram_…`
(beta orgs only).

## ChatGPT and claude.ai (OAuth)

ChatGPT custom apps only offer OAuth or no auth. claude.ai offers OAuth, plus static headers only for orgs in the beta.
Engram has no OAuth server today, so neither can connect directly. A workaround is a self-hosted header-injecting proxy
such as mcp-remote behind a tunnel, but it exposes your key to anyone with the URL, so it isn't recommended.
A minimal OAuth 2.1 shim would add:

- protected-resource metadata
- authorization-server metadata
- Dynamic Client Registration
- an `/authorize` page that reuses the dashboard login and lets the user pick a key scope
- PKCE `/token` issuing scoped Engram keys
- `WWW-Authenticate … resource_metadata=`

It's estimated at 6–10 focused hours with tests, and it isn't built.
