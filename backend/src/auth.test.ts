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

const SITE = "https://site.test/join";
const fragment = (location: string) => new URLSearchParams(new URL(location).hash.slice(1));

// Drive a full WEBSITE sign-in (ticket 06): start (302 → GitHub) then callback
// (302 → back to the site). Redirects are read manually so we can inspect Location.
async function webSignIn(
  identity: Identity,
  consent: "yes" | "no",
  returnTo = SITE,
  emails?: { email: string; primary: boolean; verified: boolean }[],
) {
  stubGitHub(identity, emails);
  const start = await SELF.fetch(
    `${BASE}/auth/web/start?consent=${consent}&return_to=${encodeURIComponent(returnTo)}`,
    { redirect: "manual" },
  );
  const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
  const cb = await SELF.fetch(`${BASE}/auth/web/callback?code=abc123&state=${state}`, { redirect: "manual" });
  return { start, cb, cbLocation: cb.headers.get("Location")! };
}

describe("website sign-in + opt-in (ticket 06 / ADR-0006)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec("DELETE FROM tokens; DELETE FROM pending_auth; DELETE FROM users;");
  });

  it("start redirects to GitHub carrying only public params — no client secret", async () => {
    const res = await SELF.fetch(`${BASE}/auth/web/start?consent=no&return_to=${encodeURIComponent(SITE)}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location")!;
    const url = new URL(loc);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-oauth-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(`${BASE}/auth/web/callback`);
    // The secret is used only server-side at the exchange — it must not leak into
    // the browser-visible authorize URL (ADR-0001, DevTools-verifiable).
    expect(loc).not.toContain("test-oauth-client-secret");

    // The opt-in answer + destination were stashed on the state row for the callback.
    const pending = await env.CATALOG.prepare("SELECT return_to, consent FROM pending_auth WHERE state = ?")
      .bind(url.searchParams.get("state"))
      .first<{ return_to: string; consent: string }>();
    expect(pending?.consent).toBe("no");
    expect(pending?.return_to).toBe(SITE);
  });

  it("an unchecked opt-in records marketing_consent = no, stamped from the website — and mints no token", async () => {
    const { cb, cbLocation } = await webSignIn({ id: 100, login: "octo", email: "octo@example.com" }, "no");

    expect(cb.status).toBe(302);
    expect(new URL(cbLocation).origin + new URL(cbLocation).pathname).toBe(SITE);
    expect(fragment(cbLocation).get("login")).toBe("octo");
    expect(fragment(cbLocation).get("consent")).toBe("no");

    const user = (await env.CATALOG.prepare("SELECT * FROM users WHERE github_id = 100").first())! as Record<
      string,
      unknown
    >;
    expect(user.marketing_consent).toBe("no"); // unchecked → no, never treated as consent
    expect(user.consent_at).toBeTruthy(); // stamped
    expect(user.consent_source).toBe("website");

    // The website flow needs no bearer token (it records consent server-side).
    const tokens = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM tokens").first<{ n: number }>();
    expect(tokens?.n).toBe(0);
  });

  it("a ticked opt-in records marketing_consent = yes", async () => {
    const { cbLocation } = await webSignIn({ id: 101, login: "yes-please", email: "y@example.com" }, "yes");
    expect(fragment(cbLocation).get("consent")).toBe("yes");

    const user = (await env.CATALOG.prepare("SELECT * FROM users WHERE github_id = 101").first())! as Record<
      string,
      unknown
    >;
    expect(user.marketing_consent).toBe("yes");
    expect(user.consent_source).toBe("website");
  });

  it("a returning user who already answered is never re-asked or overwritten", async () => {
    await webSignIn({ id: 102, login: "back", email: "b@example.com" }, "no");
    const first = (await env.CATALOG.prepare("SELECT consent_at FROM users WHERE github_id = 102").first())! as {
      consent_at: string;
    };

    // Second signup ticks the box — the guard must keep the earlier 'no' answer.
    const { cbLocation } = await webSignIn({ id: 102, login: "back", email: "b@example.com" }, "yes");
    expect(fragment(cbLocation).get("consent")).toBe("no"); // reports the STORED value, so the site won't re-prompt

    const user = (await env.CATALOG.prepare("SELECT * FROM users WHERE github_id = 102").first())! as Record<
      string,
      unknown
    >;
    expect(user.marketing_consent).toBe("no"); // unchanged
    expect(user.consent_at).toBe(first.consent_at); // not re-stamped
  });

  it("an off-list return_to falls back to a safe on-list destination (no open redirect)", async () => {
    const { cbLocation } = await webSignIn({ id: 103, login: "evil-target", email: "e@example.com" }, "yes", "https://evil.example/steal");
    // The redirect back never lands on the attacker origin.
    expect(new URL(cbLocation).origin).toBe("https://site.test");
    expect(cbLocation).not.toContain("evil.example");
  });
});
