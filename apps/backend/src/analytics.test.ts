import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setAnalyticsFetchForTests } from "./analytics";
import { __setFetchForTests } from "./github";
import { sha256Hex } from "./tokens";

const BASE = "https://backend.test";
const SITE = "https://site.test/join";

type Captured = { event: string; distinct_id: string; properties: Record<string, unknown> };

/**
 * Record what PostHog would actually receive. The seam is the outbound fetch, not a
 * mock of our own module, so these tests exercise the real `posthog-node` client and
 * assert on the wire payload — the thing that has to be right.
 */
function recordCaptures(): Captured[] {
  const seen: Captured[] = [];
  __setAnalyticsFetchForTests(async (_url, init) => {
    // posthog-node sends a gzipped Blob, not a string — unwrap it the way the real
    // endpoint would, so these tests assert on the payload PostHog actually gets.
    const body = init?.body ? await gunzip(init.body as BodyInit) : "";
    try {
      const parsed = JSON.parse(body) as { batch?: Captured[] } & Partial<Captured>;
      for (const e of parsed.batch ?? (parsed.event ? [parsed as Captured] : [])) seen.push(e);
    } catch {
      // A non-JSON body is not a capture we care about.
    }
    return Response.json({ status: 1 });
  });
  return seen;
}

async function gunzip(body: BodyInit): Promise<string> {
  const raw = await new Response(body).arrayBuffer();
  try {
    return await new Response(
      new Response(raw).body!.pipeThrough(new DecompressionStream("gzip")),
    ).text();
  } catch {
    return new TextDecoder().decode(raw); // uncompressed, e.g. a small payload
  }
}

/**
 * The tracker runs inside `ctx.waitUntil`, so captures land AFTER the response
 * resolves. Poll rather than sleep a fixed span: a wall-clock guess is a flake on a
 * loaded CI box, and polling also returns the moment the event arrives.
 */
const settled = (seen: Captured[], atLeast = 1) =>
  vi.waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(atLeast), { timeout: 2000, interval: 10 });

/** For the two cases that assert NOTHING is captured, where there is no arrival to wait for. */
const quiesced = () => new Promise((r) => setTimeout(r, 200));

function stubGitHub(identity: { id: number; login: string; email: string | null }) {
  __setFetchForTests(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_x" });
    if (url === "https://api.github.com/user") {
      return Response.json({ id: identity.id, login: identity.login, email: null });
    }
    if (url === "https://api.github.com/user/emails") {
      return Response.json(identity.email ? [{ email: identity.email, primary: true, verified: true }] : []);
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });
}

async function webSignIn(identity: { id: number; login: string; email: string | null }) {
  stubGitHub(identity);
  const start = await SELF.fetch(`${BASE}/auth/web/start?consent=no&return_to=${encodeURIComponent(SITE)}`, {
    redirect: "manual",
  });
  const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
  return SELF.fetch(`${BASE}/auth/web/callback?code=abc&state=${state}`, { redirect: "manual" });
}

async function signedInToken(githubId: number): Promise<string> {
  const raw = `tok-${githubId}`;
  const now = new Date().toISOString();
  await env.CATALOG.prepare("INSERT OR IGNORE INTO users (github_id, email, created_at) VALUES (?, ?, ?)")
    .bind(githubId, `u${githubId}@example.com`, now)
    .run();
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(raw), githubId, now)
    .run();
  return raw;
}

const SHA = "a".repeat(40);

/** One ready, pinned doc, seeded through the real upsert path (as broker.test.ts does). */
async function seedReadyDoc() {
  await SELF.fetch(`${BASE}/catalog/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-catalog-upsert-secret" },
    body: JSON.stringify({
      slug: "next.js",
      name: "Next.js",
      repo_url: "https://github.com/vercel/next.js",
      popularity_rank: 1,
      version_label: "16",
      is_latest: true,
      status: "ready",
      sha: SHA,
      docs_path: "docs",
      kg_ref: `vercel/next.js/${SHA}`,
      license: "MIT",
    }),
  });
}

describe("server-side capture (ticket 06)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec(
      "DELETE FROM subscriptions; DELETE FROM tokens; DELETE FROM pending_auth; DELETE FROM users; DELETE FROM doc_versions; DELETE FROM docs;",
    );
  });
  afterEach(() => {
    __setAnalyticsFetchForTests(async () => Response.json({ status: 1 }));
  });

  it("records signin_completed with is_new_user, keyed on the same github_id the site uses", async () => {
    const seen = recordCaptures();
    await webSignIn({ id: 100, login: "octo", email: "octo@example.com" });
    await settled(seen);

    const signin = seen.find((e) => e.event === "signin_completed");
    expect(signin).toBeDefined();
    // The join key: the site (ticket 05) identifies on this exact string, which is
    // the only reason a site visit and this sign-in land on one person.
    expect(signin!.distinct_id).toBe("100");
    expect(signin!.properties.is_new_user).toBe(true);
  });

  it("attaches the email server-side, so it never has to ride through the browser", async () => {
    const seen = recordCaptures();
    await webSignIn({ id: 101, login: "octo", email: "octo@example.com" });
    await settled(seen);

    const set = seen.find((e) => e.event === "signin_completed")!.properties.$set as Record<string, unknown>;
    expect(set).toEqual({ email: "octo@example.com", github_login: "octo" });
  });

  it("tells a returning user apart from a new one", async () => {
    await webSignIn({ id: 102, login: "back", email: "b@example.com" });
    const seen = recordCaptures();
    await webSignIn({ id: 102, login: "back", email: "b@example.com" });
    await settled(seen);

    expect(seen.find((e) => e.event === "signin_completed")!.properties.is_new_user).toBe(false);
  });

  it("records kg_download_brokered — the one authoritative download event", async () => {
    await seedReadyDoc();
    const token = await signedInToken(200);
    __setFetchForTests(async () => new Response("bundle-bytes", { status: 200 }));
    const seen = recordCaptures();

    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    await res.arrayBuffer();
    await settled(seen);

    const dl = seen.find((e) => e.event === "kg_download_brokered");
    expect(dl).toBeDefined();
    expect(dl!.distinct_id).toBe("200");
    expect(dl!.properties).toMatchObject({ doc: "next.js", version: "16", sha: SHA });
  });

  it("records download_failed with a reason when there is no deliverable KG", async () => {
    const token = await signedInToken(201);
    const seen = recordCaptures();

    const res = await SELF.fetch(`${BASE}/kg/missing`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
    await settled(seen);

    const fail = seen.find((e) => e.event === "download_failed");
    expect(fail?.properties.reason).toBe("no_deliverable_kg");
    expect(fail?.distinct_id).toBe("201");
  });

  it("records download_failed when the private bundle is unavailable", async () => {
    await seedReadyDoc();
    const token = await signedInToken(202);
    __setFetchForTests(async () => new Response("nope", { status: 500 }));
    const seen = recordCaptures();

    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(502);
    await settled(seen);

    expect(seen.find((e) => e.event === "download_failed")?.properties.reason).toBe("bundle_unavailable");
  });

  it("records watch_created once — a repeat watch is idempotent and must not inflate the count", async () => {
    await seedReadyDoc();
    const token = await signedInToken(203);
    const seen = recordCaptures();

    const watch = () =>
      SELF.fetch(`${BASE}/watch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug: "next.js" }),
      });
    expect((await watch()).status).toBe(200);
    expect((await watch()).status).toBe(200);
    await settled(seen);
    await quiesced(); // give a (wrongly) captured second watch time to show up

    expect(seen.filter((e) => e.event === "watch_created")).toHaveLength(1);
    expect(seen.find((e) => e.event === "watch_created")!.properties.doc).toBe("next.js");
  });

  it("adds no per-request catalog_served event — that is request logging, not a product event", async () => {
    const seen = recordCaptures();
    await SELF.fetch(`${BASE}/catalog`);
    await quiesced();
    expect(seen).toHaveLength(0);
  });

  it("never changes a response when capture itself throws", async () => {
    await seedReadyDoc();
    const token = await signedInToken(204);
    __setFetchForTests(async () => new Response("bundle-bytes", { status: 200 }));
    __setAnalyticsFetchForTests(async () => {
      throw new Error("PostHog is down");
    });

    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-KG-Sha")).toBe(SHA);
    expect(await res.text()).toBe("bundle-bytes");
    await quiesced();
  });

  it("reports a thrown handler error to error tracking instead of leaving it to be complained about", async () => {
    const seen = recordCaptures();
    // A doc row whose version JSON the handler cannot process: forces a throw from
    // inside the router rather than a handled error path.
    __setFetchForTests(async () => {
      throw new Error("induced failure");
    });
    await seedReadyDoc();
    const token = await signedInToken(205);

    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(500);
    await settled(seen);

    expect(seen.some((e) => e.event === "$exception")).toBe(true);
  });
});
