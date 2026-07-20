import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// Mirrors SITE_ORIGINS injected in vitest.config.ts.
const SITE = "https://site.test";
const EVIL = "https://evil.test";

describe("CORS on read-only catalog endpoints (ticket 02 site slice)", () => {
  it("GET /catalog echoes Access-Control-Allow-Origin for an allowed origin, body intact", async () => {
    const res = await SELF.fetch("https://backend.test/catalog", { headers: { Origin: SITE } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    expect(res.headers.get("Vary")).toContain("Origin");
    expect(await res.json()).toHaveProperty("docs");
  });

  it("GET /catalog/{slug} carries CORS for an allowed origin", async () => {
    const res = await SELF.fetch("https://backend.test/catalog/does-not-exist", { headers: { Origin: SITE } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
  });

  it("the local dev origin is allow-listed too (spec: 'including the local dev origin')", async () => {
    const dev = "http://localhost:3000";
    const res = await SELF.fetch("https://backend.test/catalog", { headers: { Origin: dev } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(dev);
  });

  it("a non-allowed origin gets NO Access-Control-Allow-Origin (fails closed)", async () => {
    const res = await SELF.fetch("https://backend.test/catalog", { headers: { Origin: EVIL } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("no Origin header -> no CORS header (same-origin / server-to-server unaffected)", async () => {
    const res = await SELF.fetch("https://backend.test/catalog");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS preflight on a read endpoint returns 204 + CORS for an allowed origin", async () => {
    const res = await SELF.fetch("https://backend.test/catalog", {
      method: "OPTIONS",
      headers: { Origin: SITE, "Access-Control-Request-Method": "GET" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("the write endpoint /catalog/upsert is NOT opened to CORS", async () => {
    const res = await SELF.fetch("https://backend.test/catalog/upsert", { method: "OPTIONS", headers: { Origin: SITE } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.status).not.toBe(204);
  });

  it("the OAuth exchange is NOT opened to CORS", async () => {
    const res = await SELF.fetch("https://backend.test/auth/cli/start", { method: "OPTIONS", headers: { Origin: SITE } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("the KG download broker is NOT opened to CORS", async () => {
    const res = await SELF.fetch("https://backend.test/kg/next.js", { method: "OPTIONS", headers: { Origin: SITE } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
