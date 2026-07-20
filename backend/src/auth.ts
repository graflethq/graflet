/**
 * GitHub OAuth, auth-code flow, backend-brokered (ticket 03 / ADR-0001).
 *
 * The CLI can't hold the client secret, so it never talks to GitHub directly.
 * Instead:
 *   1. CLI  POST /auth/cli/start  → backend returns an authorize_url + state.
 *   2. CLI opens the URL; the user authorizes in the browser.
 *   3. GitHub redirects the browser to  GET /auth/cli/callback  → the backend
 *      does the code exchange (client secret, backend-only), confirms identity,
 *      upserts the user, and mints its OWN bearer token.
 *   4. CLI  POST /auth/cli/poll  → collects that token.
 *
 * Sign-in is identity only: it never sets marketing_consent (ADR-0006).
 */

import { authorizeUrl, exchangeCode, fetchIdentity } from "./github";
import { randomToken, sha256Hex } from "./tokens";

const PENDING_TTL_MS = 10 * 60 * 1000; // a browser sign-in has 10 minutes to complete

const callbackUri = (req: Request) => new URL("/auth/cli/callback", req.url).toString();

/** POST /auth/cli/start — begin a browser sign-in; hand the CLI the URL to open. */
export async function handleCliStart(env: Env, req: Request): Promise<Response> {
  const state = randomToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + PENDING_TTL_MS).toISOString();

  // Sweep abandoned rows (opportunistic; volume is tiny, no cron needed).
  await env.CATALOG.prepare("DELETE FROM pending_auth WHERE expires_at < ?").bind(nowIso).run();

  await env.CATALOG.prepare("INSERT INTO pending_auth (state, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(state, nowIso, expiresIso)
    .run();

  return Response.json({
    authorize_url: authorizeUrl(env.GITHUB_OAUTH_CLIENT_ID, callbackUri(req), state),
    state,
  });
}

/** GET /auth/cli/callback — GitHub redirects the browser here after authorize. */
export async function handleCliCallback(env: Env, req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const denied = params.get("error"); // e.g. access_denied

  if (!state) return page("Sign-in link is missing its state — start again from the CLI.");
  const pending = await env.CATALOG.prepare("SELECT expires_at FROM pending_auth WHERE state = ?")
    .bind(state)
    .first<{ expires_at: string }>();
  // Reject unknown OR expired handoffs: never run the exchange / mint a token
  // for a link past its TTL, even if the sweep hasn't removed it yet.
  if (!pending || Date.parse(pending.expires_at) < Date.now()) {
    return page("This sign-in link has expired or was already used. Run the login command again.");
  }

  if (denied || !code) {
    await failPending(env, state, denied ?? "no authorization code returned");
    return page("Sign-in was cancelled. You can close this window.");
  }

  try {
    const accessToken = await exchangeCode(
      env.GITHUB_OAUTH_CLIENT_ID,
      env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      callbackUri(req),
    );
    const id = await fetchIdentity(accessToken);
    const token = await upsertUserAndMintToken(env, id.github_id, id.email);
    await env.CATALOG.prepare("UPDATE pending_auth SET token = ?, login = ?, email = ? WHERE state = ?")
      .bind(token, id.login, id.email, state)
      .run();
    return page(`Signed in as ${id.login}. You can close this window and return to the terminal.`);
  } catch (e) {
    await failPending(env, state, e instanceof Error ? e.message : "sign-in failed");
    return page("Sign-in failed. Close this window and try the login command again.");
  }
}

/** POST /auth/cli/poll {state} — the CLI collects the minted token (once). */
export async function handleCliPoll(env: Env, req: Request): Promise<Response> {
  const { state } = (await req.json().catch(() => ({}))) as { state?: string };
  if (!state) return Response.json({ status: "error", error: "missing state" }, { status: 400 });

  const row = await env.CATALOG.prepare(
    "SELECT token, login, email, error, expires_at FROM pending_auth WHERE state = ?",
  )
    .bind(state)
    .first<{ token: string | null; login: string | null; email: string | null; error: string | null; expires_at: string }>();

  if (!row) return Response.json({ status: "expired" });

  if (row.error) {
    await deletePending(env, state);
    return Response.json({ status: "error", error: row.error });
  }
  if (row.token) {
    await deletePending(env, state); // one-time: the token leaves the DB with the CLI
    return Response.json({ status: "complete", token: row.token, login: row.login, email: row.email });
  }
  if (Date.parse(row.expires_at) < Date.now()) {
    await deletePending(env, state);
    return Response.json({ status: "expired" });
  }
  return Response.json({ status: "pending" });
}

/**
 * Upsert the user (keyed by github_id, so a repeat login updates instead of
 * duplicating) and mint a fresh bearer token, stored only as a hash. Returns
 * the raw token. Never touches marketing_consent — that stays 'unset'.
 */
export async function upsertUserAndMintToken(
  env: Env,
  githubId: number,
  email: string | null,
): Promise<string> {
  const nowIso = new Date().toISOString();
  await env.CATALOG.prepare(
    `INSERT INTO users (github_id, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET email = COALESCE(excluded.email, users.email)`,
  )
    .bind(githubId, email, nowIso)
    .run();

  const raw = randomToken();
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(raw), githubId, nowIso)
    .run();
  return raw;
}

/** Tri-state marketing consent (ADR-0006). One source of truth for the union. */
export type MarketingConsent = "unset" | "yes" | "no";

export interface SessionUser {
  github_id: number;
  email: string | null;
  marketing_consent: MarketingConsent;
}

/**
 * Verify a caller's `Authorization: Bearer <token>` (a user token minted at
 * sign-in, ticket 03) and return the user row, or null if the token is
 * missing/unknown. This is the ONLY per-user gate: the download broker (05) and
 * `watch`/`consent` (08) both authenticate through here. Tokens are matched by
 * SHA-256 hash, never the raw value.
 */
export async function authenticateUser(env: Env, req: Request): Promise<SessionUser | null> {
  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided) return null;
  return env.CATALOG.prepare(
    `SELECT u.github_id, u.email, u.marketing_consent
       FROM tokens t JOIN users u ON u.github_id = t.github_id
      WHERE t.token_hash = ?`,
  )
    .bind(await sha256Hex(provided))
    .first<SessionUser>();
}

async function failPending(env: Env, state: string, error: string): Promise<void> {
  await env.CATALOG.prepare("UPDATE pending_auth SET error = ? WHERE state = ?").bind(error, state).run();
}

async function deletePending(env: Env, state: string): Promise<void> {
  await env.CATALOG.prepare("DELETE FROM pending_auth WHERE state = ?").bind(state).run();
}

// Minimal self-closing confirmation page shown in the user's browser.
function page(message: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>docs-kg</title>
<body style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:0 1rem;text-align:center">
<p>${message}</p></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
