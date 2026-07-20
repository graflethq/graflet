import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// The test-only upsert secret injected in vitest.config.ts.
const SECRET = "test-catalog-upsert-secret";

type UpsertBody = Record<string, unknown>;

async function upsert(body: UpsertBody, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers.Authorization = `Bearer ${secret}`;
  return SELF.fetch("https://backend.test/catalog/upsert", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// A ready, green, latest version for one doc — the shape the pipeline POSTs.
function readyDoc(over: UpsertBody = {}): UpsertBody {
  return {
    slug: "next.js",
    name: "Next.js",
    repo_url: "https://github.com/vercel/next.js",
    popularity_rank: 1,
    version_label: "16",
    is_latest: true,
    status: "ready",
    sha: "a".repeat(40),
    docs_path: "docs",
    kg_ref: "vercel/next.js/" + "a".repeat(40),
    license: "MIT",
    graphscore: 87.5,
    hero_savings: 123456,
    ...over,
  };
}

describe("catalog API (ticket 02)", () => {
  it("POST /catalog/upsert with no / wrong secret is rejected (401), body ignored", async () => {
    expect((await upsert(readyDoc(), null)).status).toBe(401);
    expect((await upsert(readyDoc(), "wrong")).status).toBe(401);
    // Nothing was written.
    const res = await SELF.fetch("https://backend.test/catalog");
    const { docs } = (await res.json()) as { docs: unknown[] };
    expect(docs.find((d: any) => d.slug === "next.js")).toBeUndefined();
  });

  it("POST /catalog/upsert with the secret loads a ready doc, served with NO sign-in", async () => {
    expect((await upsert(readyDoc())).status).toBe(200);

    const res = await SELF.fetch("https://backend.test/catalog"); // no Authorization header
    expect(res.status).toBe(200);
    const { docs } = (await res.json()) as { docs: any[] };
    const nx = docs.find((d) => d.slug === "next.js");
    // The list carries repo_url + graphscore too, so the site table renders the
    // Library sub-label + GraphScore column without a per-row detail fetch.
    expect(nx).toMatchObject({
      slug: "next.js",
      name: "Next.js",
      repo_url: "https://github.com/vercel/next.js",
      license: "MIT",
      popularity_rank: 1,
      latest_version: "16",
      graphscore: 87.5,
      hero_savings: 123456,
    });
  });

  it("GET /catalog is ordered by popularity rank", async () => {
    await upsert(readyDoc({ slug: "react", name: "React", repo_url: "https://github.com/facebook/react", version_label: "19", popularity_rank: 5, kg_ref: "x" }));
    await upsert(readyDoc({ slug: "vue", name: "Vue", repo_url: "https://github.com/vuejs/core", version_label: "3", popularity_rank: 3, kg_ref: "y" }));
    const { docs } = (await (await SELF.fetch("https://backend.test/catalog")).json()) as { docs: any[] };
    const ranks = docs.map((d) => d.popularity_rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("GET /catalog/{slug} lists versions and resolves latest to {repo_url, sha, docs_path, kg_ref} only", async () => {
    await upsert(readyDoc());
    const res = await SELF.fetch("https://backend.test/catalog/next.js");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toMatchObject({ slug: "next.js", repo_url: "https://github.com/vercel/next.js", license: "MIT" });
    expect(body.versions[0]).toMatchObject({ version_label: "16", is_latest: true, status: "ready" });
    // resolve returns ONLY the four pin fields (+ echoed version), never KG bytes.
    expect(body.resolve).toEqual({
      version: "16",
      repo_url: "https://github.com/vercel/next.js",
      sha: "a".repeat(40),
      docs_path: "docs",
      kg_ref: "vercel/next.js/" + "a".repeat(40),
    });
  });

  it("GET /catalog/{slug}?version=<old> resolves that specific version", async () => {
    await upsert(readyDoc()); // v16 latest
    await upsert(readyDoc({ version_label: "15", is_latest: false, sha: "b".repeat(40), kg_ref: "vercel/next.js/" + "b".repeat(40) }));
    const body = (await (await SELF.fetch("https://backend.test/catalog/next.js?version=15")).json()) as any;
    expect(body.resolve.version).toBe("15");
    expect(body.resolve.sha).toBe("b".repeat(40));
  });

  it("GET /catalog/{unknown} -> 404", async () => {
    expect((await SELF.fetch("https://backend.test/catalog/does-not-exist")).status).toBe(404);
  });

  it("a ready doc with no recorded pin (the seeded, pre-P1 state) lists but does not resolve", async () => {
    // Seed shape: ready + green, but the immutable {sha} isn't recorded until the
    // re-graphify (P1) fills it via upsert. It is browsable but not yet deliverable.
    await upsert(readyDoc({ slug: "seeded", name: "Seeded", repo_url: "https://github.com/x/seeded", sha: undefined, docs_path: undefined, kg_ref: undefined }));
    const { docs } = (await (await SELF.fetch("https://backend.test/catalog")).json()) as { docs: any[] };
    expect(docs.find((d) => d.slug === "seeded")).toBeDefined(); // listed
    const body = (await (await SELF.fetch("https://backend.test/catalog/seeded")).json()) as any;
    expect(body.versions[0].status).toBe("ready");
    expect(body.resolve).toBeNull(); // not deliverable without a pin
  });

  it("upsert is idempotent — re-POSTing the same payload leaves the row identical", async () => {
    await upsert(readyDoc());
    const first = await (await SELF.fetch("https://backend.test/catalog/next.js")).json();
    await upsert(readyDoc());
    const second = await (await SELF.fetch("https://backend.test/catalog/next.js")).json();
    expect(second).toEqual(first);
  });

  it("a non-green license is NEVER moved to ready — rejected, never served", async () => {
    const res = await upsert(readyDoc({ slug: "gpl-doc", name: "GPL Doc", repo_url: "https://github.com/x/gpl", license: "GPL-3.0", kg_ref: "z" }));
    expect(res.status).toBe(422);
    const { docs } = (await (await SELF.fetch("https://backend.test/catalog")).json()) as { docs: any[] };
    expect(docs.find((d) => d.slug === "gpl-doc")).toBeUndefined();
    // And it is not resolvable.
    expect((await SELF.fetch("https://backend.test/catalog/gpl-doc")).status).toBe(404);
  });

  it("CC-BY-SA (share-alike) is treated as non-green", async () => {
    expect((await upsert(readyDoc({ slug: "sa", name: "SA", license: "CC-BY-SA-4.0", kg_ref: "z" }))).status).toBe(422);
  });

  it("a needs_human version is held provisional and never served as ready", async () => {
    const res = await upsert(readyDoc({ slug: "prov", name: "Prov", repo_url: "https://github.com/x/prov", needs_human: true, kg_ref: "p" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).status).toBe("provisional"); // held, not ready
    // Not surfaced in the ready catalog list...
    const { docs } = (await (await SELF.fetch("https://backend.test/catalog")).json()) as { docs: any[] };
    expect(docs.find((d) => d.slug === "prov")).toBeUndefined();
    // ...and its detail resolve is refused (not ready).
    const body = (await (await SELF.fetch("https://backend.test/catalog/prov")).json()) as any;
    expect(body.resolve).toBeNull();
  });

  it("a new version appends a row, flips is_latest, and the old frozen version stays resolvable unchanged", async () => {
    await upsert(readyDoc()); // v16 latest, sha=aaaa
    await upsert(readyDoc({ version_label: "17", sha: "c".repeat(40), kg_ref: "vercel/next.js/" + "c".repeat(40) })); // v17 latest

    const body = (await (await SELF.fetch("https://backend.test/catalog/next.js")).json()) as any;
    const v16 = body.versions.find((v: any) => v.version_label === "16");
    const v17 = body.versions.find((v: any) => v.version_label === "17");
    expect(v17.is_latest).toBe(true);
    expect(v16.is_latest).toBe(false);
    // latest resolve now points at v17...
    expect(body.resolve.version).toBe("17");
    expect(body.resolve.sha).toBe("c".repeat(40));
    // ...but v16's frozen pin is untouched and still resolvable at that version.
    const old = (await (await SELF.fetch("https://backend.test/catalog/next.js?version=16")).json()) as any;
    expect(old.resolve.sha).toBe("a".repeat(40));
    // GET /catalog shows v17 as the latest_version.
    const { docs } = (await (await SELF.fetch("https://backend.test/catalog")).json()) as { docs: any[] };
    expect(docs.find((d) => d.slug === "next.js").latest_version).toBe("17");
  });
});
