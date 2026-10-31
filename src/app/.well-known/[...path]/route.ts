// Engram authenticates MCP clients with a static bearer key, not OAuth. MCP clients probe
// /.well-known/oauth-protected-resource, /.well-known/oauth-authorization-server and
// /.well-known/openid-configuration during discovery; answer with a clean JSON 404 instead of the HTML not-found page.
export const dynamic = "force-dynamic";

const body = JSON.stringify({
  error: "not_found",
  error_description: "Engram does not use OAuth. Send your Engram key as 'Authorization: Bearer engram_...' to /mcp.",
});
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };

const notFound = () => new Response(body, { status: 404, headers });
export const GET = notFound;
export const POST = notFound;
export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Mcp-Protocol-Version" } });
}
