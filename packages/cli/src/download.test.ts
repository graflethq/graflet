import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { download } from "./download.js";

const API = "https://backend.test";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const enc = new TextEncoder();

// --- Minimal hermetic tar.gz builder (no system `tar`) --------------------
function tarHeader(name: string, size: number, typeflag: string): Uint8Array {
  const h = new Uint8Array(512);
  const put = (s: string, off: number, len: number) => h.set(enc.encode(s).subarray(0, len), off);
  put(name, 0, 100);
  put("0000644", 100, 7);
  put(size.toString(8).padStart(11, "0"), 124, 12);
  h[156] = typeflag.charCodeAt(0);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  for (let i = 148; i < 156; i++) h[i] = 0x20;
  let sum = 0;
  for (const b of h) sum += b;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}
function block(name: string, data: Uint8Array, typeflag = "0"): Uint8Array {
  const pad = (512 - (data.length % 512)) % 512;
  const out = new Uint8Array(512 + data.length + pad);
  out.set(tarHeader(name, data.length, typeflag));
  out.set(data, 512);
  return out;
}
function makeTarGz(entries: Uint8Array[]): Uint8Array {
  const end = new Uint8Array(1024);
  const total = entries.reduce((n, e) => n + e.length, 0) + end.length;
  const buf = new Uint8Array(total);
  let o = 0;
  for (const e of entries) {
    buf.set(e, o);
    o += e.length;
  }
  buf.set(end, o);
  return new Uint8Array(gzipSync(buf));
}

const resolve = { version: "16", repo_url: "https://github.com/me/myrepo", sha: SHA, docs_path: "docs", kg_ref: "me/myrepo/" + SHA };

// The upstream codeload tarball (docs subtree) + the KG bundle tarball (flat files).
const docsTarGz = makeTarGz([block(`myrepo-${SHA}/docs/intro.md`, enc.encode("# Intro\n"))]);
const bundleTarGz = makeTarGz([
  block("./graph.json", enc.encode('{"nodes":[]}')),
  block("./graph.html", enc.encode("<html></html>")),
  block("./GRAPH_REPORT.md", enc.encode("# Report")),
  block("./savings.json", enc.encode('{"tokens":1}')),
  block("./LICENSE", enc.encode("MIT")),
]);

// Route the CLI's fetches: catalog resolve → JSON, codeload → docs, /kg → bundle.
function stub(opts: { resolveBody?: unknown; kgSha?: string | null } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: any, init: any) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/catalog/")) return Response.json(opts.resolveBody ?? { resolve });
    if (url.includes("codeload.github.com")) return new Response(docsTarGz);
    if (url.includes("/kg/")) {
      const headers = opts.kgSha === undefined ? { "X-KG-Sha": SHA } : opts.kgSha === null ? {} : { "X-KG-Sha": opts.kgSha };
      return new Response(bundleTarGz, { headers });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const dest = () => mkdtempSync(join(tmpdir(), "dl-"));

describe("cli download — the spine (ticket 05)", () => {
  it("signed out: does not call the backend, exits 1", async () => {
    const { calls, fetchImpl } = stub();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => null });
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("signed in: writes BOTH the docs/** Markdown AND the full KG bundle to disk", async () => {
    const out = dest();
    const { calls, fetchImpl } = stub();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out });

    expect(code).toBe(0);
    // Source 1: the .md, byte-for-byte under docs/.
    expect(readFileSync(join(out, "docs", "intro.md"), "utf8")).toBe("# Intro\n");
    // Source 2: every KG bundle file.
    for (const f of ["graph.json", "graph.html", "GRAPH_REPORT.md", "savings.json", "LICENSE"]) {
      expect(existsSync(join(out, f))).toBe(true);
    }
    // The .md came from anonymous codeload (no api.github.com, no token to GitHub).
    const codeload = calls.find((u) => u.includes("codeload.github.com"));
    expect(codeload).toBe(`https://codeload.github.com/me/myrepo/tar.gz/${SHA}`);
    expect(calls.some((u) => u.includes("api.github.com"))).toBe(false);
  });

  it("refuses to write EITHER source when the KG's sha doesn't match — no .md-only path (ADR-0002)", async () => {
    const out = dest();
    const { fetchImpl } = stub({ kgSha: "f".repeat(40) }); // broker returns a different sha
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out });
    expect(code).toBe(1);
    expect(existsSync(join(out, "graph.json"))).toBe(false); // mismatched KG not written
    expect(existsSync(join(out, "docs", "intro.md"))).toBe(false); // and NOT left as a .md-only dir
  });

  it("an expected failure (unknown slug -> 404) throws its user-facing message (caught+printed by main)", async () => {
    // main() catches this and prints err.message, not a stack; download itself throws.
    const fetchImpl = (async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    await expect(
      download("nope", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => dest() }),
    ).rejects.toThrow(/No doc named "nope"/);
  });

  it("a browsable-but-not-deliverable doc (resolve null, pre-P1 seed) exits 1", async () => {
    const out = dest();
    const { calls, fetchImpl } = stub({ resolveBody: { resolve: null } });
    const code = await download("seeded", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out });
    expect(code).toBe(1);
    expect(calls.some((u) => u.includes("/kg/"))).toBe(false); // never asked the broker
  });

  it("picks a specific version from <slug>@<version>", async () => {
    const { calls, fetchImpl } = stub();
    await download("next.js@15", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => dest() });
    expect(calls.some((u) => u.includes("/catalog/next.js?version=15"))).toBe(true);
    expect(calls.some((u) => u.includes("/kg/next.js?version=15"))).toBe(true);
  });
});
