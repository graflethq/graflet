/**
 * docs-kg-backend — the always-up Cloudflare Worker backend (ADR-0004).
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
 */

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
  };
  const ok = Object.values(checks).every(Boolean);

  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}

function isSet(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}
