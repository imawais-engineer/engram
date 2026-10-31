import "server-only";

/** Origins allowed to call the MCP endpoint from a browser: NEXT_PUBLIC_APP_URL (the site itself) plus ENGRAM_ALLOWED_ORIGINS (comma-separated). */
export function allowedOrigins(req: Request): Set<string> {
  const set = new Set<string>();
  const add = (v?: string | null) => { if (!v) return; try { set.add(new URL(v.trim()).origin); } catch { /* ignore malformed */ } };
  add(process.env.NEXT_PUBLIC_APP_URL);
  for (const o of (process.env.ENGRAM_ALLOWED_ORIGINS || "").split(",")) add(o);
  // The Host header is attacker-controlled (that is how DNS rebinding works), so it is only trusted for local dev.
  const host = req.headers.get("host") || "";
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) add(`http://${host}`);
  return set;
}

export function originAllowed(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return !origin; // no Origin = non-browser client; literal "null" (sandboxed/file) is rejected
  return allowedOrigins(req).has(origin);
}
