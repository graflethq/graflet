/**
 * graflet-backend — the always-up Cloudflare Worker backend (ADR-0004).
 *
 * Ticket 01 scope: the deployable shell only. It wires the three runtime deps
 * that tickets 02/03/05 build directly on (the catalog store + two secrets) and
 * exposes just enough to prove they are reachable:
 *
 *   GET /health  Public liveness. 200 "ok", no auth — the one always-public
 *                surface (ADR-0005: the only gated action is a KG download).
 *   GET /ready   Readiness. Does a trivial D1 read (SELECT 1) to prove the
 *                CATALOG binding answers, and confirms both secrets are present.
 *                Returns booleans only — never a secret value.
 *
 * Ticket 03 adds the GitHub OAuth auth-code flow (see ./auth):
 *   POST /auth/cli/start   GET /auth/cli/callback   POST /auth/cli/poll
 */

import { handleCliCallback, handleCliPoll, handleCliStart, handleWebCallback, handleWebStart } from "./auth";
import { handleKgDownload } from "./broker";
import { handleCatalogDoc, handleCatalogList, handleCatalogUpsert } from "./catalog";
import { corsPreflight, isCatalogReadPath, withCors } from "./cors";
import { handleConsent, handleUnsubscribe, handleWatch } from "./watch";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    // Liveness: public, no dependencies, no auth.
    if (pathname === "/health") {
      return new Response("ok");
    }

    // Readiness: proves the catalog store + both secrets are wired, so
    // tickets 02/03/05 can assume them with no re-wiring.
    if (pathname === "/ready") {
      return handleReady(env);
    }

    // GitHub OAuth (ticket 03). All public: login is the path TO an identity,
    // not gated by one (ADR-0005 gates only the KG download).
    if (pathname === "/auth/cli/start" && req.method === "POST") {
      return handleCliStart(env, req);
    }
    if (pathname === "/auth/cli/callback" && req.method === "GET") {
      return handleCliCallback(env, req);
    }
    if (pathname === "/auth/cli/poll" && req.method === "POST") {
      return handleCliPoll(env, req);
    }

    // Website sign-in (ticket 06). Same OAuth exchange as the CLI, but the browser
    // navigates through these directly (no CORS) and is redirected back to the site;
    // the opt-in answer rides through and is recorded server-side (ADR-0006).
    // Deploy note: the GitHub OAuth app's callback URL must cover BOTH /auth/cli/
    // and /auth/web/ — register the parent `…/auth/` so both redirect_uris match.
    if (pathname === "/auth/web/start" && req.method === "GET") {
      return handleWebStart(env, req);
    }
    if (pathname === "/auth/web/callback" && req.method === "GET") {
      return handleWebCallback(env, req);
    }

    // CORS preflight for the two public read endpoints only (site slice, ticket 02).
    // The site fetches the catalog cross-origin; every other route stays same-origin.
    if (req.method === "OPTIONS" && isCatalogReadPath(pathname)) {
      return corsPreflight(env, req);
    }

    // Catalog (ticket 02). Reads are public (ADR-0005 gates only the KG download);
    // /catalog/upsert is shared-secret (the pipeline + poller keep it live).
    if (pathname === "/catalog/upsert" && req.method === "POST") {
      return handleCatalogUpsert(env, req);
    }
    // The two read endpoints carry CORS for the site origin; upsert (above) does not.
    if (pathname === "/catalog" && req.method === "GET") {
      return withCors(await handleCatalogList(env), env, req);
    }
    if (pathname.startsWith("/catalog/") && req.method === "GET") {
      const slug = decodeURIComponent(pathname.slice("/catalog/".length));
      return withCors(await handleCatalogDoc(env, slug, new URL(req.url).searchParams.get("version")), env, req);
    }

    // KG download broker (ticket 05) — the ONE auth-gated action (ADR-0005):
    // verify the caller's bearer, then stream the private-repo KG bytes.
    if (pathname.startsWith("/kg/") && req.method === "GET") {
      const slug = decodeURIComponent(pathname.slice("/kg/".length));
      return handleKgDownload(env, req, slug, new URL(req.url).searchParams.get("version"));
    }

    // Watch + consent (ticket 08). Both auth-gated (user bearer, ADR-0005 gates
    // watch); consent captures the CLI marketing opt-in.
    if (pathname === "/watch" && req.method === "POST") {
      return handleWatch(env, req);
    }
    if (pathname === "/consent" && req.method === "POST") {
      return handleConsent(env, req);
    }
    // Public, token-verified: the one-click unsubscribe link in promo emails.
    if (pathname === "/unsubscribe" && (req.method === "GET" || req.method === "POST")) {
      return handleUnsubscribe(env, req);
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleReady(env: Env): Promise<Response> {
  // Trivial read against the catalog store. No schema needed — ticket 02 owns
  // the tables; SELECT 1 only proves the D1 binding is reachable at runtime.
  let catalog = false;
  try {
    const row = await env.CATALOG.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    catalog = row?.ok === 1;
  } catch {
    catalog = false;
  }

  // Presence, not value: a configured secret is a non-empty string. The value
  // itself is never read, logged, or returned (ticket criterion: presence only).
  const checks = {
    catalog,
    private_repo_token: isSet(env.PRIVATE_REPO_TOKEN),
    oauth_client_secret: isSet(env.GITHUB_OAUTH_CLIENT_SECRET),
    catalog_upsert_secret: isSet(env.CATALOG_UPSERT_SECRET),
  };
  const ok = Object.values(checks).every(Boolean);

  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}

function isSet(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}
