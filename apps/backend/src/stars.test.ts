import { SELF } from "cloudflare:test";
import { beforeEach, describe, it, expect } from "vitest";
import { __setFetchForTests } from "./github";
import { CACHE_KEY } from "./stars";

const BASE = "https://backend.test";
const SITE = "https://site.test";
const EVIL = "https://evil.test";

/** Calls GitHub actually made, so a test can prove the hour-long cache spared them. */
let calls: { url: string; headers: Headers }[] = [];

/** A stub api.github.com. `repo` is whatever /repos/{owner}/{name} should answer. */
function stubGitHub(repo: unknown, status = 200) {
  calls = [];
  __setFetchForTests(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url === "https://api.github.com/repos/graflethq/graflet") {
      return status === 200 ? Response.json(repo) : new Response("nope", { status });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });
}

// One isolate = one cache for the whole file, so an earlier test's cached count
// would answer a later test's request. Every test starts cold.
beforeEach(() => caches.default.delete(CACHE_KEY));

async function stars(origin?: string) {
  const res = await SELF.fetch(`${BASE}/stars`, origin ? { headers: { Origin: origin } } : undefined);
  return { res, body: (await res.json()) as { stars: number | null } };
}

describe("GET /stars — the nav's star count", () => {
  beforeEach(() => stubGitHub({ stargazers_count: 1247 }));

  it("answers the repo's star count as JSON", async () => {
    const { res, body } = await stars();
    expect(res.status).toBe(200);
    expect(body.stars).toBe(1247);
  });

  it("authenticates the GitHub call and sends a User-Agent", async () => {
    await stars();
    // Unauthenticated is 60/hr per IP, and a Worker's egress IP is shared across all
    // of Cloudflare — without the token this 403s at random. GitHub 403s a missing UA.
    const call = calls.find((c) => c.url.endsWith("/repos/graflethq/graflet"));
    expect(call?.headers.get("Authorization")).toBe("Bearer test-private-repo-token");
    expect(call?.headers.get("User-Agent")).toBe("graflet-backend");
  });

  it("serves the second request from cache without calling GitHub again", async () => {
    await stars();
    const before = calls.length;
    const { body } = await stars();
    expect(body.stars).toBe(1247);
    expect(calls.length).toBe(before); // the whole point of the route
  });

  it("carries CORS for an allowed origin, and none for anyone else", async () => {
    expect((await stars(SITE)).res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    expect((await stars(EVIL)).res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS preflight is opened, like the catalog reads", async () => {
    const res = await SELF.fetch(`${BASE}/stars`, {
      method: "OPTIONS",
      headers: { Origin: SITE, "Access-Control-Request-Method": "GET" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
  });
});

describe("GET /stars — upstream failure is a designed state, not a 5xx", () => {
  it("a GitHub error answers { stars: null } with a 200, and is not cached", async () => {
    stubGitHub(null, 503);
    const { res, body } = await stars();
    expect(res.status).toBe(200);
    expect(body.stars).toBeNull();
    // A transient failure must not pin an empty count for the next hour.
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a malformed GitHub body is treated as a failure, never rendered as a count", async () => {
    stubGitHub({ nope: true });
    expect((await stars()).body.stars).toBeNull();
  });
});
