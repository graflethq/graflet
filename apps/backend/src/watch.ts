/**
 * Watch subscriptions + marketing consent + unsubscribe (ticket 08 / ADR-0006).
 *
 *   POST /watch        Auth-gated. Register (user, doc); idempotent. Returns the
 *                      caller's marketing_consent so the CLI knows whether to prompt.
 *   POST /consent      Auth-gated. Records the CLI marketing opt-in — ONLY when
 *                      consent is still 'unset' (never re-asked / never overwritten).
 *   GET|POST /unsubscribe  Public, token-verified. One-click marketing opt-out
 *                      (RFC 8058): flips marketing_consent to 'no'. Service
 *                      notifications still send; only the promo footer stops.
 */

import { authenticateUser } from "./auth";
import { unsubscribeToken } from "./notify";
import { sha256Hex } from "./tokens";

/** POST /watch {slug} — subscribe the signed-in user to a doc's updates. */
export async function handleWatch(env: Env, req: Request): Promise<Response> {
  const user = await authenticateUser(env, req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { slug?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });

  const doc = await env.CATALOG.prepare("SELECT slug FROM docs WHERE slug = ?").bind(slug).first();
  if (!doc) return Response.json({ error: "unknown doc" }, { status: 404 });

  await env.CATALOG.prepare(
    `INSERT INTO subscriptions (github_id, slug, created_at) VALUES (?, ?, ?)
     ON CONFLICT(github_id, slug) DO NOTHING`,
  )
    .bind(user.github_id, slug, new Date().toISOString())
    .run();

  return Response.json({ ok: true, slug, marketing_consent: user.marketing_consent });
}

/** POST /consent {answer:"yes"|"no"} — record the CLI marketing opt-in, once. */
export async function handleConsent(env: Env, req: Request): Promise<Response> {
  const user = await authenticateUser(env, req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { answer?: unknown } | null;
  const answer = body?.answer;
  if (answer !== "yes" && answer !== "no") {
    return Response.json({ error: "answer must be 'yes' or 'no'" }, { status: 400 });
  }

  // Guarded to marketing_consent = 'unset': the opt-in is asked once and never
  // overwrites an existing answer (ADR-0006). A repeat call is a no-op.
  const res = await env.CATALOG.prepare(
    `UPDATE users SET marketing_consent = ?, consent_at = ?, consent_source = 'cli'
      WHERE github_id = ? AND marketing_consent = 'unset'`,
  )
    .bind(answer, new Date().toISOString(), user.github_id)
    .run();

  return Response.json({ ok: true, recorded: res.meta.changes > 0 });
}

/** GET|POST /unsubscribe?u=<github_id>&t=<token> — one-click marketing opt-out. */
export async function handleUnsubscribe(env: Env, req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const u = Number(params.get("u"));
  const t = params.get("t") ?? "";
  // Compare digests of both sides (same convention as catalog.ts `authorized`),
  // so the check leaks no timing signal about the expected token.
  const expected = Number.isInteger(u) ? await unsubscribeToken(u, env.UNSUBSCRIBE_SECRET) : "";
  const ok = t !== "" && (await sha256Hex(t)) === (await sha256Hex(expected));
  if (!ok) return textOrJson(req, "This unsubscribe link is invalid.", 400);

  // Idempotent: always land on 'no' (suppresses the promo footer); service
  // notifications still send. consent_source records how it happened.
  await env.CATALOG.prepare(
    `UPDATE users SET marketing_consent = 'no', consent_at = ?, consent_source = 'unsubscribe'
      WHERE github_id = ?`,
  )
    .bind(new Date().toISOString(), u)
    .run();

  return textOrJson(req, "You've been unsubscribed from product updates. You'll still get updates for docs you watch.", 200);
}

// A GET click gets a human page; a one-click POST (RFC 8058) gets a bare 200.
function textOrJson(req: Request, message: string, status: number): Response {
  if (req.method === "POST") return Response.json({ ok: status === 200 }, { status });
  const html = `<!doctype html><meta charset="utf-8"><title>docs-kg</title>
<body style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:0 1rem;text-align:center">
<p>${message}</p></body>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
