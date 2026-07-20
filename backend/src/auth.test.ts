import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, it, expect } from "vitest";
import { __setFetchForTests } from "./github";
import { sha256Hex } from "./tokens";

const BASE = "https://backend.test";

type Identity = { id: number; login: string; email: string | null };

// A stub GitHub: token exchange + identity. `emails` defaults to a single
// primary+verified address (or none, when the identity email is null).
function stubGitHub(identity: Identity, emails?: { email: string; primary: boolean; verified: boolean }[]) {
  const emailList = emails ?? (identity.email ? [{ email: identity.email, primary: true, verified: true }] : []);
  __setFetchForTests(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: "gho_test_access" });
    }
    if (url === "https://api.github.com/user") {
      return Response.json({ id: identity.id, login: identity.login, email: null });
    }
    if (url === "https://api.github.com/user/emails") {
      return Response.json(emailList);
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });
}

// Run a full browser sign-in for the given identity, returning the poll result.
async function signIn(identity: Identity, emails?: { email: string; primary: boolean; verified: boolean }[]) {
  stubGitHub(identity, emails);
  const start = (await (await SELF.fetch(`${BASE}/auth/cli/start`, { method: "POST" })).json()) as {
    authorize_url: string;
    state: string;
  };
  const cb = await SELF.fetch(`${BASE}/auth/cli/callback?code=abc123&state=${start.state}`);
  expect(cb.status).toBe(200);
  const poll = await SELF.fetch(`${BASE}/auth/cli/poll`, {
    method: "POST",
    body: JSON.stringify({ state: start.state }),
  });
  return { start, poll: (await poll.json()) as { status: string; token?: string; login?: string; email?: string } };
}

describe("GitHub OAuth (ticket 03)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec("DELETE FROM tokens; DELETE FROM pending_auth; DELETE FROM users;");
  });

  it("start returns an authorize_url that routes back to the backend callback", async () => {
    const res = await SELF.fetch(`${BASE}/auth/cli/start`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorize_url: string; state: string };
    const url = new URL(body.authorize_url);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-oauth-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(`${BASE}/auth/cli/callback`);
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toBe(body.state);
  });

  it("first login creates exactly one user row and issues a working token", async () => {
    const { poll } = await signIn({ id: 42, login: "octocat", email: "octo@example.com" });

    expect(poll.status).toBe("complete");
    expect(poll.login).toBe("octocat");
    expect(poll.email).toBe("octo@example.com");
    expect(poll.token).toBeTruthy();

    const users = await env.CATALOG.prepare("SELECT * FROM users WHERE github_id = 42").all();
    expect(users.results).toHaveLength(1);
    const user = users.results[0] as Record<string, unknown>;
    expect(user.email).toBe("octo@example.com");
    expect(user.created_at).toBeTruthy();
    // Login is identity only — consent stays unset (ADR-0006).
    expect(user.marketing_consent).toBe("unset");
    expect(user.consent_at).toBeNull();

    // The issued token is persisted as a hash (never raw), keyed to the user.
    const tok = await env.CATALOG.prepare("SELECT github_id FROM tokens WHERE token_hash = ?")
      .bind(await sha256Hex(poll.token!))
      .first<{ github_id: number }>();
    expect(tok?.github_id).toBe(42);
  });

  it("a second login by the same GitHub account updates the row, never duplicates", async () => {
    await signIn({ id: 7, login: "hubot", email: "hubot@old.com" });
    const first = await env.CATALOG.prepare("SELECT created_at FROM users WHERE github_id = 7").first<{
      created_at: string;
    }>();

    await signIn({ id: 7, login: "hubot", email: "hubot@new.com" });

    const users = await env.CATALOG.prepare("SELECT * FROM users WHERE github_id = 7").all();
    expect(users.results).toHaveLength(1); // upsert, not insert
    const user = users.results[0] as Record<string, unknown>;
    expect(user.email).toBe("hubot@new.com"); // refreshed
    expect(user.created_at).toBe(first?.created_at); // first sign-in preserved
    expect(user.marketing_consent).toBe("unset"); // still never touched

    // Two logins → two distinct tokens (laptop + CI both stay valid).
    const tokens = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM tokens WHERE github_id = 7").first<{
      n: number;
    }>();
    expect(tokens?.n).toBe(2);
  });

  it("a repeat login that resolves no email keeps the previously stored one", async () => {
    await signIn({ id: 9, login: "ghost", email: "keep@me.com" });
    // Second sign-in: the account now exposes no email at all.
    await signIn({ id: 9, login: "ghost", email: null }, []);

    const user = await env.CATALOG.prepare("SELECT email FROM users WHERE github_id = 9").first<{
      email: string | null;
    }>();
    expect(user?.email).toBe("keep@me.com"); // NULL must not clobber the core asset
  });

  it("an expired sign-in link cannot complete — no exchange, no token", async () => {
    stubGitHub({ id: 5, login: "late", email: "late@example.com" });
    const past = new Date(Date.now() - 60_000).toISOString();
    await env.CATALOG.prepare("INSERT INTO pending_auth (state, created_at, expires_at) VALUES (?, ?, ?)")
      .bind("expired-state", past, past)
      .run();

    const cb = await SELF.fetch(`${BASE}/auth/cli/callback?code=abc&state=expired-state`);
    expect(cb.status).toBe(200);

    const users = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    const tokens = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM tokens").first<{ n: number }>();
    expect(users?.n).toBe(0);
    expect(tokens?.n).toBe(0);
  });

  it("polling before the browser finishes returns pending", async () => {
    const start = (await (await SELF.fetch(`${BASE}/auth/cli/start`, { method: "POST" })).json()) as {
      state: string;
    };
    const poll = await SELF.fetch(`${BASE}/auth/cli/poll`, {
      method: "POST",
      body: JSON.stringify({ state: start.state }),
    });
    expect(((await poll.json()) as { status: string }).status).toBe("pending");
  });

  it("a cancelled authorization surfaces as an error, no user created", async () => {
    const start = (await (await SELF.fetch(`${BASE}/auth/cli/start`, { method: "POST" })).json()) as {
      state: string;
    };
    await SELF.fetch(`${BASE}/auth/cli/callback?error=access_denied&state=${start.state}`);
    const poll = await SELF.fetch(`${BASE}/auth/cli/poll`, {
      method: "POST",
      body: JSON.stringify({ state: start.state }),
    });
    expect(((await poll.json()) as { status: string }).status).toBe("error");
    const users = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(users?.n).toBe(0);
  });
});
