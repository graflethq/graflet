/**
 * CORS for the two public, read-only catalog endpoints (ticket 02, site slice).
 *
 * The website is a separate frontend app; it lists docs by calling GET /catalog
 * and GET /catalog/{slug} straight from the browser (cross-origin), so those two
 * responses must carry Access-Control-Allow-Origin for the site's origin. The
 * data is already public (ADR-0005 gates only the KG download) — CORS just lets
 * the browser's same-origin policy hand the bytes to the page's JS.
 *
 * Everything else (upsert, OAuth, broker, watch/consent) gets NO CORS header, so
 * a script on any other origin can't drive it from a browser.
 *
 * The allow-list is env.SITE_ORIGINS (comma-separated) — prod + local dev are
 * config, not code. An Origin off the list gets no header and the fetch fails
 * closed, exactly as an un-opened endpoint would.
 */

/** The request's Origin iff it is on the SITE_ORIGINS allow-list, else null. */
export function allowedOrigin(env: Env, req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  const allow = (env.SITE_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(origin) ? origin : null;
}

/** True for the two public read paths (list + detail); never for /catalog/upsert. */
export function isCatalogReadPath(pathname: string): boolean {
  if (pathname === "/catalog/upsert") return false;
  return pathname === "/catalog" || pathname.startsWith("/catalog/");
}

/** 204 preflight for a read endpoint; CORS headers only for an allowed origin. */
export function corsPreflight(env: Env, req: Request): Response {
  const headers = new Headers({ "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" });
  headers.append("Vary", "Origin");
  setAllowOrigin(headers, env, req);
  return new Response(null, { status: 204, headers });
}

/** Copy `res` with CORS headers added when the caller's origin is allowed. */
export function withCors(res: Response, env: Env, req: Request): Response {
  const headers = new Headers(res.headers);
  headers.append("Vary", "Origin");
  setAllowOrigin(headers, env, req);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Set Access-Control-Allow-Origin to the caller's origin iff it is allow-listed. */
function setAllowOrigin(headers: Headers, env: Env, req: Request): void {
  const origin = allowedOrigin(env, req);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
}
