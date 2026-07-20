import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("docs-kg-backend skeleton (ticket 01)", () => {
  it("GET /health -> 200 ok, no auth", async () => {
    const res = await SELF.fetch("https://backend.test/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("GET /ready -> 200 with the catalog store reachable and both secrets present", async () => {
    const res = await SELF.fetch("https://backend.test/ready");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      checks: { catalog: boolean; private_repo_token: boolean; oauth_client_secret: boolean; catalog_upsert_secret: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.checks).toEqual({
      catalog: true,
      private_repo_token: true,
      oauth_client_secret: true,
      catalog_upsert_secret: true,
    });
  });

  it("unknown path -> 404", async () => {
    const res = await SELF.fetch("https://backend.test/nope");
    expect(res.status).toBe(404);
  });

  it("env exposes all three runtime deps to the fetch handler (presence, not values)", () => {
    expect(typeof env.PRIVATE_REPO_TOKEN).toBe("string");
    expect(env.PRIVATE_REPO_TOKEN.length).toBeGreaterThan(0);
    expect(typeof env.GITHUB_OAUTH_CLIENT_SECRET).toBe("string");
    expect(env.GITHUB_OAUTH_CLIENT_SECRET.length).toBeGreaterThan(0);
    expect(env.CATALOG).toBeDefined();
    // A live D1Database exposes prepare().
    expect(typeof env.CATALOG.prepare).toBe("function");
  });
});
