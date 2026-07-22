/**
 * Thin GitHub OAuth + API calls used by the auth-code flow (ticket 03).
 *
 * All outbound HTTP goes through `fetchImpl`, a module singleton that defaults
 * to the global `fetch`. Tests swap it via `__setFetchForTests` so the worker's
 * real routing runs without touching github.com (this pool shares one isolate
 * between the test and the main worker, so the swap is seen by both).
 */

let fetchImpl: typeof fetch = (input, init) => fetch(input, init);

/** Test-only: replace the fetch used for GitHub calls. */
export function __setFetchForTests(f: typeof fetch): void {
  fetchImpl = f;
}

const AUTHORIZE = "https://github.com/login/oauth/authorize";
const ACCESS_TOKEN = "https://github.com/login/oauth/access_token";
const API_USER = "https://api.github.com/user";
const API_EMAILS = "https://api.github.com/user/emails";
const API_REPOS = "https://api.github.com/repos";

// Identity only: who they are + their email. No repo/write scopes.
export const SCOPES = "read:user user:email";

export interface GitHubIdentity {
  github_id: number;
  login: string;
  email: string | null;
}

/** Build the URL the CLI opens in the browser. */
export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    allow_signup: "true",
  });
  return `${AUTHORIZE}?${q}`;
}

/** Exchange the `code` for a GitHub access token. Needs the client secret —
 *  the reason this runs on the backend and never in the CLI. */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetchImpl(ACCESS_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`token exchange failed: ${body.error ?? res.status}`);
  }
  return body.access_token;
}

/** Confirm the identity behind a GitHub access token: id, login, best email. */
export async function fetchIdentity(accessToken: string): Promise<GitHubIdentity> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    // GitHub requires a User-Agent on API calls or it 403s.
    "User-Agent": "graflet-backend",
  };
  const userRes = await fetchImpl(API_USER, { headers });
  if (!userRes.ok) throw new Error(`GET /user failed: ${userRes.status}`);
  const user = (await userRes.json()) as { id: number; login: string; email: string | null };

  return { github_id: user.id, login: user.login, email: await bestEmail(headers, user.email) };
}

/**
 * Fetch one file's raw bytes from a private repo (the pruned KG bundle tarball),
 * authenticated with the server-side token (ticket 05 / ADR-0002). The `raw` media
 * type returns the file bytes directly (up to 100 MB) — GitHub follows its own
 * internal signed-URL redirect server-side, so the caller only ever sees bytes.
 * Returns the raw Response so the broker can stream `res.body` straight through
 * under its OWN headers; the server token never leaves the backend.
 */
export function fetchPrivateBundle(repo: string, path: string, token: string): Promise<Response> {
  const url = `${API_REPOS}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  return fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "User-Agent": "graflet-backend",
    },
  });
}

// /user.email is often null (dev hid it). /user/emails (needs user:email scope)
// gives the real one; prefer primary+verified, then any verified.
async function bestEmail(headers: Record<string, string>, fallback: string | null): Promise<string | null> {
  try {
    const res = await fetchImpl(API_EMAILS, { headers });
    if (!res.ok) return fallback;
    const emails = (await res.json()) as { email: string; primary: boolean; verified: boolean }[];
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) return primary.email;
    const verified = emails.find((e) => e.verified);
    if (verified) return verified.email;
  } catch {
    // fall through to whatever /user gave us
  }
  return fallback;
}
