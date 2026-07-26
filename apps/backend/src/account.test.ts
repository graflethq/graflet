import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setAnalyticsFetchForTests } from "./analytics";
import { __setFetchForTests } from "./github";
import { sha256Hex } from "./tokens";

const BASE = "https://backend.test";
const SITE_ORIGIN = "https://site.test";
const RETURN_TO = `${SITE_ORIGIN}/privacy`;

/** What the Worker actually sent to PostHog's private API, in order. */
type PersonDelete = { url: string; auth: string | null; body: Record<string, unknown> };

/**
 * Stub the outbound PostHog leg. The seam is the same shared `analyticsFetch` that
 * capture uses, so this has to tell the two apart by host: capture posts to
 * `us.i.posthog.com`, person deletion to `us.posthog.com`. `fail` makes the delete
 * call error the way an outage or a bad key would.
 */
function recordPersonDeletes(fail?: "status" | "throw" | "deletion_errors"): PersonDelete[] {
  const seen: PersonDelete[] = [];
  __setAnalyticsFetchForTests(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (!url.includes("/persons/bulk_delete/")) return Response.json({ status: 1 }); // a capture
    if (fail === "throw") throw new Error("PostHog unreachable");
    seen.push({
      url,
      auth: new Headers(init?.headers).get("Authorization"),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    if (fail === "status") return new Response("nope", { status: 500 });
    if (fail === "deletion_errors") {
      return Response.json({ persons_found: 1, persons_deleted: 0, deletion_errors: [{ person_uuid: "u" }] });
    }
    return Response.json({ persons_found: 1, persons_deleted: 1, deletion_errors: [] }, { status: 202 });
  });
  return seen;
}

function stubGitHub(identity: { id: number; login: string; email: string | null }) {
  __setFetchForTests(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_x" });
    if (url === "https://api.github.com/user") return Response.json({ id: identity.id, login: identity.login, email: null });
    if (url === "https://api.github.com/user/emails") {
      return Response.json(identity.email ? [{ email: identity.email, primary: true, verified: true }] : []);
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });
}

/** Kick off the deletion OAuth round trip; returns the CSRF state it was issued. */
async function startDeleteFlow(identity: { id: number; login: string; email: string | null }): Promise<string> {
  stubGitHub(identity);
  const start = await SELF.fetch(`${BASE}/auth/web/start?intent=delete&return_to=${encodeURIComponent(RETURN_TO)}`, {
    redirect: "manual",
  });
  return new URL(start.headers.get("Location")!).searchParams.get("state")!;
}

/** Run the deletion OAuth round trip and return the one-time token from the fragment. */
async function deleteTokenFor(identity: { id: number; login: string; email: string | null }): Promise<string | null> {
  const state = await startDeleteFlow(identity);
  const cb = await SELF.fetch(`${BASE}/auth/web/callback?code=abc&state=${state}`, { redirect: "manual" });
  const frag = new URLSearchParams(new URL(cb.headers.get("Location")!).hash.slice(1));
  return frag.get("delete_token");
}

const confirmDelete = (token: string) =>
  SELF.fetch(`${BASE}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SITE_ORIGIN },
    body: JSON.stringify({ token }),
  });

/** An account with a row in every table keyed to a github_id. */
async function seedFullAccount(githubId: number, rawToken: string) {
  const now = new Date().toISOString();
  await env.CATALOG.prepare("INSERT INTO users (github_id, email, created_at) VALUES (?, ?, ?)")
    .bind(githubId, `u${githubId}@example.com`, now)
    .run();
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(rawToken), githubId, now)
    .run();
  // A second machine's token: "all machines" is the point — a logged-in CLI must not
  // keep working with a token belonging to a deleted account.
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(`${rawToken}-laptop`), githubId, now)
    .run();
  await env.CATALOG.prepare(
    "INSERT OR IGNORE INTO docs (slug, name, repo_url, license_id, popularity_rank) VALUES (?, ?, ?, ?, ?)",
  )
    .bind("next.js", "Next.js", "https://github.com/vercel/next.js", "MIT", 1)
    .run();
  await env.CATALOG.prepare("INSERT INTO subscriptions (github_id, slug, created_at) VALUES (?, ?, ?)")
    .bind(githubId, "next.js", now)
    .run();
}

const countFor = async (table: string, githubId: number): Promise<number> => {
  const row = await env.CATALOG.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE github_id = ?`)
    .bind(githubId)
    .first<{ n: number }>();
  return row?.n ?? 0;
};

/** Every table keyed to a github_id, so "no row survives" is checked exhaustively. */
const survivingRows = async (githubId: number) => ({
  users: await countFor("users", githubId),
  tokens: await countFor("tokens", githubId),
  subscriptions: await countFor("subscriptions", githubId),
  pending_auth: await countFor("pending_auth", githubId),
});

describe("account deletion — erase our rows AND the PostHog person (ticket 09)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec(
      "DELETE FROM subscriptions; DELETE FROM tokens; DELETE FROM pending_auth; DELETE FROM users; DELETE FROM doc_versions; DELETE FROM docs;",
    );
  });
  afterEach(() => {
    __setAnalyticsFetchForTests(async () => Response.json({ status: 1 }));
  });

  it("deletes every row keyed to that github_id — users, all tokens, subscriptions", async () => {
    recordPersonDeletes();
    await seedFullAccount(500, "tok-500");
    expect(await survivingRows(500)).toMatchObject({ users: 1, tokens: 2, subscriptions: 1 });

    const token = await deleteTokenFor({ id: 500, login: "octo", email: "o@example.com" });
    const res = await confirmDelete(token!);

    expect(res.status).toBe(200);
    expect(await survivingRows(500)).toEqual({ users: 0, tokens: 0, subscriptions: 0, pending_auth: 0 });
  });

  it("a token belonging to the deleted account stops authenticating the CLI", async () => {
    recordPersonDeletes();
    await seedFullAccount(501, "tok-501");
    const token = await deleteTokenFor({ id: 501, login: "octo", email: null });
    await confirmDelete(token!);

    // The download broker is the one gated route (ADR-0005) — the honest end-to-end
    // check that a deleted account cannot keep using a token it was issued.
    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: "Bearer tok-501" } });
    expect(res.status).toBe(401);
  });

  it("deletes the PostHog person for that distinct_id, in the same request", async () => {
    const deletes = recordPersonDeletes();
    await seedFullAccount(502, "tok-502");
    const token = await deleteTokenFor({ id: 502, login: "octo", email: null });

    expect((await confirmDelete(token!)).status).toBe(200);
    expect(deletes).toHaveLength(1);
    // The distinct_id is the github_id as a string — the same join key the site,
    // the CLI and server-side capture all use. Anything else deletes nobody.
    expect(deletes[0].body).toEqual({ distinct_ids: ["502"], delete_events: true, delete_recordings: true });
    // The private API host + the personal key, never the write-only project key.
    expect(deletes[0].url).toBe("https://us.posthog.com/api/projects/12345/persons/bulk_delete/");
    expect(deletes[0].auth).toBe("Bearer phx_test_personal_key");
  });

  it("reports a PostHog failure instead of swallowing it, and deletes nothing", async () => {
    recordPersonDeletes("status");
    await seedFullAccount(503, "tok-503");
    const token = await deleteTokenFor({ id: 503, login: "octo", email: null });

    const res = await confirmDelete(token!);

    expect(res.status).toBe(502);
    // The whole reason PostHog goes first: a half-done erasure leaves a person
    // profile keyed to an account nobody can name any more.
    expect(await survivingRows(503)).toMatchObject({ users: 1, tokens: 2, subscriptions: 1 });
  });

  it("treats per-person errors in a 2xx body as a failure too", async () => {
    // PostHog reports these inside an otherwise-successful response, so reading only
    // the status code would turn exactly this case into a false success.
    recordPersonDeletes("deletion_errors");
    await seedFullAccount(504, "tok-504");
    const token = await deleteTokenFor({ id: 504, login: "octo", email: null });

    expect((await confirmDelete(token!)).status).toBe(502);
    expect(await countFor("users", 504)).toBe(1);
  });

  it("the same link retries after a failure and finishes the job", async () => {
    recordPersonDeletes("throw");
    await seedFullAccount(505, "tok-505");
    const token = await deleteTokenFor({ id: 505, login: "octo", email: null });
    expect((await confirmDelete(token!)).status).toBe(502);

    recordPersonDeletes(); // PostHog is back
    expect((await confirmDelete(token!)).status).toBe(200);
    expect(await survivingRows(505)).toEqual({ users: 0, tokens: 0, subscriptions: 0, pending_auth: 0 });
  });

  it("is idempotent: deleting an account that is already gone succeeds", async () => {
    const deletes = recordPersonDeletes();
    await seedFullAccount(506, "tok-506");
    expect((await confirmDelete((await deleteTokenFor({ id: 506, login: "octo", email: null }))!)).status).toBe(200);

    // A second full round trip for the same GitHub identity: nothing left to delete,
    // and that has to read as done rather than as an error.
    const second = await deleteTokenFor({ id: 506, login: "octo", email: null });
    expect((await confirmDelete(second!)).status).toBe(200);
    expect(deletes).toHaveLength(2);
    expect(await survivingRows(506)).toEqual({ users: 0, tokens: 0, subscriptions: 0, pending_auth: 0 });
  });

  it("spends the token once — a replay of the same link is rejected", async () => {
    recordPersonDeletes();
    await seedFullAccount(507, "tok-507");
    const token = await deleteTokenFor({ id: 507, login: "octo", email: null });
    expect((await confirmDelete(token!)).status).toBe(200);

    expect((await confirmDelete(token!)).status).toBe(400);
  });

  it("rejects an unknown token, and a missing one", async () => {
    recordPersonDeletes();
    expect((await confirmDelete("not-a-real-token")).status).toBe(400);
    const res = await SELF.fetch(`${BASE}/account/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("will not spend a SIGN-IN token on a deletion", async () => {
    // The CLI handoff parks a raw bearer in the same pending_auth.token column. Only
    // the intent tells them apart, which is why it is part of the lookup.
    const deletes = recordPersonDeletes();
    await seedFullAccount(508, "tok-508");
    stubGitHub({ id: 508, login: "octo", email: null });
    const start = await SELF.fetch(`${BASE}/auth/cli/start`, { method: "POST" });
    const { state } = (await start.json()) as { state: string };
    await SELF.fetch(`${BASE}/auth/cli/callback?code=abc&state=${state}`);
    const row = await env.CATALOG.prepare("SELECT token FROM pending_auth WHERE state = ?")
      .bind(state)
      .first<{ token: string }>();

    expect((await confirmDelete(row!.token)).status).toBe(400);
    expect(deletes).toHaveLength(0);
    expect(await countFor("users", 508)).toBe(1);
  });

  it("the CLI poll cannot collect a deletion token, or destroy the handoff on its way past", async () => {
    // pending_auth is shared by three flows and two of them now park a token on a
    // row. If poll matched on `state` alone, anyone who knew a deletion handoff's
    // state could collect that account's one-time token — skipping the confirmation
    // this whole two-leg design exists to require — and delete the row while doing it.
    recordPersonDeletes();
    await seedFullAccount(511, "tok-511");
    const state = await startDeleteFlow({ id: 511, login: "octo", email: null });
    const cb = await SELF.fetch(`${BASE}/auth/web/callback?code=abc&state=${state}`, { redirect: "manual" });
    const deleteToken = new URLSearchParams(new URL(cb.headers.get("Location")!).hash.slice(1)).get("delete_token")!;

    const poll = await SELF.fetch(`${BASE}/auth/cli/poll`, { method: "POST", body: JSON.stringify({ state }) });

    expect(await poll.json()).toEqual({ status: "expired" }); // no token, no identity
    // …and the real owner's confirmation still works, so the poll did not consume it.
    expect((await confirmDelete(deleteToken)).status).toBe(200);
  });

  it("the CLI callback cannot hijack a deletion handoff into a live bearer", async () => {
    // The other direction of the same invariant: running the CLI exchange over a
    // deletion row would overwrite its token with a real bearer — which POST
    // /account/delete would then spend — and re-create the very user row being erased.
    recordPersonDeletes();
    await seedFullAccount(512, "tok-512");
    const state = await startDeleteFlow({ id: 512, login: "octo", email: null });

    const res = await SELF.fetch(`${BASE}/auth/cli/callback?code=abc&state=${state}`);

    expect(await res.text()).toMatch(/expired or was already used/i);
    const row = await env.CATALOG.prepare("SELECT token FROM pending_auth WHERE state = ?")
      .bind(state)
      .first<{ token: string | null }>();
    expect(row?.token).toBeNull(); // no bearer minted onto the deletion row
  });

  it("the deletion leg neither signs the user in nor recreates their row", async () => {
    recordPersonDeletes();
    // Nobody seeded: an account that does not exist must not be brought into being
    // by asking to delete it — `upsertUser` on this leg would do exactly that.
    await deleteTokenFor({ id: 509, login: "ghost", email: "g@example.com" });

    expect(await countFor("users", 509)).toBe(0);
  });

  it("carries CORS so the site can read the result of the deletion it just ran", async () => {
    recordPersonDeletes();
    await seedFullAccount(510, "tok-510");
    const token = await deleteTokenFor({ id: 510, login: "octo", email: null });

    const preflight = await SELF.fetch(`${BASE}/account/delete`, {
      method: "OPTIONS",
      headers: { Origin: SITE_ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");

    const res = await confirmDelete(token!);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE_ORIGIN);
  });
});
