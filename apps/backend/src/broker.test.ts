import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, it, expect } from "vitest";
import { __setFetchForTests } from "./github";
import { sha256Hex } from "./tokens";

const BASE = "https://backend.test";
const SECRET = "test-catalog-upsert-secret";
const SHA = "a".repeat(40);
const KG_REF = "vercel/next.js/" + SHA;
const BUNDLE = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 1, 2, 3, 4]); // a tiny fake .tar.gz

// Record every GitHub call the broker makes, and hand back a fake bundle for the
// private-repo contents URL.
function stubPrivateRepo() {
  const calls: { url: string; headers: Headers }[] = [];
  __setFetchForTests(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.includes("/contents/")) return new Response(BUNDLE, { status: 200 });
    throw new Error(`unexpected fetch in test: ${url}`);
  });
  return calls;
}

// Seed one ready, pinned doc via the real upsert path.
async function seedReadyDoc() {
  await SELF.fetch(`${BASE}/catalog/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
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
      kg_ref: KG_REF,
      license: "MIT",
    }),
  });
}

// Mint a working user bearer directly (the auth flow is covered in auth.test.ts).
async function signedInToken(): Promise<string> {
  const raw = "user-bearer-token";
  const now = new Date().toISOString();
  await env.CATALOG.prepare("INSERT INTO users (github_id, email, created_at) VALUES (?, ?, ?)").bind(1, "u@e.com", now).run();
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(raw), 1, now)
    .run();
  return raw;
}

describe("KG download broker (ticket 05)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec("DELETE FROM tokens; DELETE FROM users; DELETE FROM doc_versions; DELETE FROM docs;");
  });

  it("rejects a request with no bearer (401) and never touches the private repo", async () => {
    const calls = stubPrivateRepo();
    await seedReadyDoc();
    const res = await SELF.fetch(`${BASE}/kg/next.js`);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("rejects an unknown bearer (401)", async () => {
    stubPrivateRepo();
    await seedReadyDoc();
    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: "Bearer not-a-real-token" } });
    expect(res.status).toBe(401);
  });

  it("a valid caller gets the KG streamed from the PRIVATE repo with the server token", async () => {
    const calls = stubPrivateRepo();
    await seedReadyDoc();
    const token = await signedInToken();

    const res = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/gzip");
    // The bytes are the private bundle, streamed through (not a URL).
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BUNDLE);
    // No redirect and the server token is not leaked to the client.
    expect(res.headers.get("Location")).toBeNull();
    expect(res.headers.get("Authorization")).toBeNull();

    // The broker fetched the PRIVATE repo's {kg_ref}.tar.gz with the SERVER token.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://api.github.com/repos/graflethq/kg-bundles/contents/${KG_REF}.tar.gz`);
    expect(calls[0].headers.get("Authorization")).toBe("Bearer test-private-repo-token");
  });

  it("the streamed sha (X-KG-Sha) equals the resolved catalog pin — .md/KG align by construction", async () => {
    stubPrivateRepo();
    await seedReadyDoc();
    const token = await signedInToken();

    const kg = await SELF.fetch(`${BASE}/kg/next.js`, { headers: { Authorization: `Bearer ${token}` } });
    const resolved = (await (await SELF.fetch(`${BASE}/catalog/next.js`)).json()) as { resolve: { sha: string } };
    expect(kg.headers.get("X-KG-Sha")).toBe(SHA);
    expect(kg.headers.get("X-KG-Sha")).toBe(resolved.resolve.sha);
  });

  it("a doc with no deliverable pin (unknown / not-ready) is 404, not brokered", async () => {
    const calls = stubPrivateRepo();
    const token = await signedInToken();
    const res = await SELF.fetch(`${BASE}/kg/does-not-exist`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0); // never reached the private repo
  });

  it("browse + version listing stay public — only the download is gated (ADR-0005)", async () => {
    stubPrivateRepo();
    await seedReadyDoc();
    expect((await SELF.fetch(`${BASE}/catalog`)).status).toBe(200); // list, no auth
    expect((await SELF.fetch(`${BASE}/catalog/next.js`)).status).toBe(200); // detail + versions, no auth
    expect((await SELF.fetch(`${BASE}/kg/next.js`)).status).toBe(401); // download alone needs auth
  });
});
