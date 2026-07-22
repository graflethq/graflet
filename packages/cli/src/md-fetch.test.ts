import { describe, it, expect, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchMarkdown, parseRepo, codeloadUrl } from "./md-fetch";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const enc = new TextEncoder();

// --- Minimal tar builder, so tests are hermetic (no system `tar` needed) ---
function tarHeader(name: string, size: number, typeflag: string): Uint8Array {
  const h = new Uint8Array(512);
  const put = (s: string, off: number, len: number) => h.set(enc.encode(s).subarray(0, len), off);
  put(name, 0, 100);
  put("0000644", 100, 7);
  put(size.toString(8).padStart(11, "0"), 124, 12);
  h[156] = typeflag.charCodeAt(0);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  for (let i = 148; i < 156; i++) h[i] = 0x20; // checksum field = spaces while summing
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
/** A pax extended-header record "<len> key=value\n" where <len> is the BYTE length
 *  (counting itself) — built over bytes so multibyte keys/values are exercised. */
function paxRecord(kv: string): Uint8Array {
  const kvBytes = enc.encode(kv);
  const bodyLen = 1 + kvBytes.length + 1; // leading space + kv + trailing newline
  let len = bodyLen;
  for (;;) {
    const t = String(len).length + bodyLen;
    if (t === len) break;
    len = t;
  }
  const prefix = enc.encode(`${len} `);
  const out = new Uint8Array(prefix.length + kvBytes.length + 1);
  out.set(prefix, 0);
  out.set(kvBytes, prefix.length);
  out[out.length - 1] = 0x0a; // "\n"
  return out;
}
function makeTarGz(entries: Array<Uint8Array>): Uint8Array {
  const end = new Uint8Array(1024); // two zero blocks
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

function fakeFetch(tarGz: Uint8Array) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(tarGz)) as unknown as typeof fetch;
}

describe("parseRepo / codeloadUrl", () => {
  it("parses org/repo from a github repo_url and builds the anonymous codeload URL", () => {
    expect(parseRepo("https://github.com/vercel/next.js")).toEqual({ org: "vercel", repo: "next.js" });
    expect(parseRepo("https://github.com/vercel/next.js.git/")).toEqual({ org: "vercel", repo: "next.js" });
    expect(codeloadUrl("vercel", "next.js", SHA)).toBe(`https://codeload.github.com/vercel/next.js/tar.gz/${SHA}`);
  });
});

describe("fetchMarkdown (ticket 04)", () => {
  const dest = () => mkdtempSync(join(tmpdir(), "mdfetch-"));
  const top = `myrepo-${SHA}`;

  it("fetches only from codeload (no api.github.com, no auth header) and writes the docs subtree byte-for-byte", async () => {
    const bytes = enc.encode("# Intro\nhello\n");
    const tarGz = makeTarGz([
      block(`${top}/`, new Uint8Array(0), "5"),
      block(`${top}/docs/`, new Uint8Array(0), "5"),
      block(`${top}/docs/intro.md`, bytes),
      block(`${top}/README.md`, enc.encode("not docs")), // outside docs_path
    ]);
    const f = fakeFetch(tarGz);
    const d = dest();

    const written = await fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: SHA, docs_path: "docs" }, d, { fetchImpl: f });

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(`https://codeload.github.com/me/myrepo/tar.gz/${SHA}`);
    expect(String(url)).not.toContain("api.github.com");
    expect(init?.headers).toBeUndefined(); // no token / no auth header
    // Only the docs subtree was written (README.md skipped), prefix stripped.
    expect(written).toEqual([join(d, "docs", "intro.md")]);
    expect(readFileSync(join(d, "docs", "intro.md"))).toEqual(Buffer.from(bytes)); // byte-exact
  });

  it("honors a pax long-path header (as codeload emits for long paths)", async () => {
    const longName = `${top}/docs/really/deep/nested/component-reference/button.md`;
    const bytes = enc.encode("button docs");
    const tarGz = makeTarGz([
      block("pax_header", paxRecord(`path=${longName}`), "x"),
      block(`${top}/SHORT`, bytes), // the ustar name is ignored; pax path wins
    ]);
    const d = dest();
    const written = await fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: SHA, docs_path: "docs" }, d, { fetchImpl: fakeFetch(tarGz) });
    expect(written).toEqual([join(d, "docs", "really", "deep", "nested", "component-reference", "button.md")]);
    expect(readFileSync(written[0])).toEqual(Buffer.from(bytes));
  });

  it("parses a multibyte pax path over bytes (non-ASCII doc filename)", async () => {
    const longName = `${top}/docs/guía/café-☕.md`; // multibyte: pax len is a BYTE count
    const bytes = enc.encode("acentos");
    const tarGz = makeTarGz([block("pax_header", paxRecord(`path=${longName}`), "x"), block(`${top}/SHORT`, bytes)]);
    const d = dest();
    const written = await fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: SHA, docs_path: "docs" }, d, { fetchImpl: fakeFetch(tarGz) });
    expect(written).toEqual([join(d, "docs", "guía", "café-☕.md")]);
    expect(readFileSync(written[0])).toEqual(Buffer.from(bytes));
  });

  it("rejects an unresolved source WITHOUT fetching (pre-P1 null sha / missing fields)", async () => {
    const f = fakeFetch(makeTarGz([]));
    await expect(fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: "", docs_path: "docs" }, dest(), { fetchImpl: f })).rejects.toThrow(/unresolved/i);
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects a sha that isn't a 40-char commit pin WITHOUT fetching", async () => {
    const f = fakeFetch(makeTarGz([]));
    await expect(fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: "main", docs_path: "docs" }, dest(), { fetchImpl: f })).rejects.toThrow(/sha/i);
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses a path-traversal entry in the archive", async () => {
    const tarGz = makeTarGz([block(`${top}/docs/../../evil.md`, enc.encode("x"))]);
    await expect(fetchMarkdown({ repo_url: "https://github.com/me/myrepo", sha: SHA, docs_path: "docs" }, dest(), { fetchImpl: fakeFetch(tarGz) })).rejects.toThrow(/unsafe/i);
  });
});
