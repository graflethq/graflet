/**
 * CORS for the public, read-only endpoints (ticket 02, site slice).
 *
 * The website is a separate frontend app; it lists docs by calling GET /catalog
 * and GET /catalog/{slug} straight from the browser (cross-origin), and reads the
 * repo's star count from GET /stars the same way, so those responses must carry
 * Access-Control-Allow-Origin for the site's origin. The data is already public
 * (ADR-0005 gates only the KG download) — CORS just lets the browser's same-origin
 * policy hand the bytes to the page's JS.
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

/** True for the public read paths (catalog list + detail, star count); never for
 *  /catalog/upsert, which is a write behind a shared secret. */
export function isPublicReadPath(pathname: string): boolean {
  if (pathname === "/catalog/upsert") return false;
  return pathname === "/catalog" || pathname.startsWith("/catalog/") || pathname === "/stars";
}

/**
 * Every path the site may call cross-origin: the public reads above, plus the
 * account-deletion confirm (ticket 09). That one is a write, and opened anyway
 * because it authenticates on a one-time token minted through GitHub rather than on
 * the caller's origin — CORS was never the thing protecting it, and without the
 * header the browser could not read the result of a deletion it just performed.
 */
export function isCorsPath(pathname: string): boolean {
  return isPublicReadPath(pathname) || pathname === "/account/delete";
}

/**
 * 204 preflight for a CORS path; CORS headers only for an allowed origin.
 *
 * The answer is per-path, not one blanket reply: opening the catalog reads to POST
 * because a different endpoint needs it would advertise a method they do not accept.
 */
export function corsPreflight(env: Env, req: Request): Response {
  const read = isPublicReadPath(new URL(req.url).pathname);
  const headers = new Headers({
    "Access-Control-Allow-Methods": read ? "GET, OPTIONS" : "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  });
  // A JSON body is what makes /account/delete preflighted rather than a simple
  // request, so the browser needs Content-Type named back before it will send it.
  if (!read) headers.set("Access-Control-Allow-Headers", "Content-Type");
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
