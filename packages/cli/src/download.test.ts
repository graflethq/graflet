import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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
// A current bundle: meta.json + savings.json carry the closing numbers the CLI prints.
const bundleTarGz = makeTarGz([
  block("./graph.json", enc.encode('{"nodes":[]}')),
  block("./graph.html", enc.encode("<html></html>")),
  block("./GRAPH_REPORT.md", enc.encode("# Report")),
  block("./meta.json", enc.encode(`{"sha":"${SHA}","version_label":"16","nodes":2803,"edges":2874}`)),
  block(
    "./savings.json",
    enc.encode(
      '{"build_cost":{"build_cost_usd":1.6494},"local_time":{"estimated_total_seconds":34711},' +
        '"coverage":{"documents":149},"structure":{"nodes":2803,"edges":2874,"communities":385}}',
    ),
  ),
  block("./LICENSE", enc.encode("MIT")),
]);
// An OLD bundle: built before savings.json/meta.json existed. Every closing number is
// unknowable from it, and the CLI must stay silent rather than print undefined/NaN.
const oldBundleTarGz = makeTarGz([
  block("./graph.json", enc.encode('{"nodes":[]}')),
  block("./LICENSE", enc.encode("MIT")),
]);

// Route the CLI's fetches: catalog resolve → JSON, codeload → docs, /kg → bundle.
function stub(opts: { resolveBody?: unknown; kgSha?: string | null; bundle?: Uint8Array; kgBody?: () => BodyInit } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: any, init: any) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/catalog/")) return Response.json(opts.resolveBody ?? { resolve });
    if (url.includes("codeload.github.com")) return new Response(docsTarGz);
    if (url.includes("/kg/")) {
      const headers = opts.kgSha === undefined ? { "X-KG-Sha": SHA } : opts.kgSha === null ? {} : { "X-KG-Sha": opts.kgSha };
      return new Response(opts.kgBody ? opts.kgBody() : (opts.bundle ?? bundleTarGz), { headers });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const dest = () => mkdtempSync(join(tmpdir(), "dl-"));

/**
 * Capture both streams and pin BOTH tty flags OFF. Never a real TTY in a test: the live
 * frame installs an interval and a SIGINT handler per run, and its escape bytes would bury
 * the one thing an assertion is looking for. The two flags are separate on purpose — stdout
 * and stderr redirect independently, and conflating them was a real bug (see the
 * piped-stdout test at the bottom).
 */
function sink(over: { isTTY?: boolean; isStdoutTTY?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    deps: {
      isTTY: over.isTTY ?? false,
      isStdoutTTY: over.isStdoutTTY ?? false,
      log: (m: string) => void out.push(m),
      writeErr: (c: string) => void err.push(c),
    },
    /** Everything the user would have seen, both streams. */
    text: () => out.join("\n") + "\n" + err.join(""),
  };
}

describe("cli download — the spine (ticket 05)", () => {
  it("signed out: does not call the backend, exits 1, and says so on STDERR", async () => {
    const { calls, fetchImpl } = stub();
    const s = sink();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => null, ...s.deps });
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
    // An error on stdout would both vanish from the terminal under `> where.txt` AND become
    // the "path" a script reads. Every early exit belongs to the reader, so: stderr.
    expect(s.err.join("")).toContain("Downloading a KG needs a sign-in.");
    expect(s.out).toEqual([]);
  });

  it("signed in: writes BOTH the docs/** Markdown AND the full KG bundle to disk", async () => {
    const out = dest();
    const { calls, fetchImpl } = stub();
    const s = sink();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });

    expect(code).toBe(0);
    // Source 1: the .md, byte-for-byte under docs/.
    expect(readFileSync(join(out, "docs", "intro.md"), "utf8")).toBe("# Intro\n");
    // Source 2: every KG bundle file, under graphify-out/ — never loose at the root, so a
    // `**/*.md` sweep of the docs can't pick up the bundle's own GRAPH_REPORT.md.
    for (const f of ["graph.json", "graph.html", "GRAPH_REPORT.md", "savings.json"]) {
      expect(existsSync(join(out, "graphify-out", f))).toBe(true);
      expect(existsSync(join(out, f))).toBe(false);
    }
    // …except the LICENSE, which licenses the DOCS and is lifted back out to the root.
    expect(readFileSync(join(out, "LICENSE"), "utf8")).toBe("MIT");
    expect(existsSync(join(out, "graphify-out", "LICENSE"))).toBe(false);
    // The .md came from anonymous codeload (no api.github.com, no token to GitHub).
    const codeload = calls.find((u) => u.includes("codeload.github.com"));
    expect(codeload).toBe(`https://codeload.github.com/me/myrepo/tar.gz/${SHA}`);
    expect(calls.some((u) => u.includes("api.github.com"))).toBe(false);

    // Everything a human reads is on stderr. Plain mode: the same words as the TTY frame,
    // minus the ✔/spinner glyphs.
    const err = s.err.join("");
    expect(err).toContain(`graflet · next.js → ./${basename(out)}/`);
    expect(err).toContain("Resolved 16 → 0123456 · docs and graph aligned");
    expect(err).toContain("Downloaded docs → 1 files (");
    expect(err).toContain("Fetched graph → 2,803 nodes · 2,874 edges");
    expect(err).toMatch(/Done in \d/);
    expect(err).toContain("Saved ~9h 38m of local build · ~$1.65 in API cost");
    // …and stdout is the payload alone, so `cd "$(graflet next.js)"` needs no parsing.
    expect(s.out).toEqual([out]);
  });

  it("refuses to write EITHER source when the KG's sha doesn't match — no .md-only path (ADR-0002)", async () => {
    const out = dest();
    const { fetchImpl } = stub({ kgSha: "f".repeat(40) }); // broker returns a different sha
    const s = sink();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });
    expect(code).toBe(1);
    expect(existsSync(join(out, "graphify-out"))).toBe(false); // mismatched KG not written
    expect(existsSync(join(out, "docs", "intro.md"))).toBe(false); // and NOT left as a .md-only dir
  });

  it("an expected failure (unknown slug -> 404) throws its user-facing message (caught+printed by main)", async () => {
    // main() catches this and prints err.message, not a stack; download itself throws.
    const fetchImpl = (async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    await expect(
      download("nope", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => dest(), ...sink().deps }),
    ).rejects.toThrow(/No doc named "nope"/);
  });

  it("a browsable-but-not-deliverable doc (resolve null, pre-P1 seed) exits 1", async () => {
    const out = dest();
    const { calls, fetchImpl } = stub({ resolveBody: { resolve: null } });
    const s = sink();
    const code = await download("seeded", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });
    expect(code).toBe(1);
    expect(calls.some((u) => u.includes("/kg/"))).toBe(false); // never asked the broker
  });

  it("picks a specific version from <slug>@<version>", async () => {
    const { calls, fetchImpl } = stub();
    await download("next.js@15", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => dest(), ...sink().deps });
    expect(calls.some((u) => u.includes("/catalog/next.js?version=15"))).toBe(true);
    expect(calls.some((u) => u.includes("/kg/next.js?version=15"))).toBe(true);
  });

  it("a KG body that dies mid-stream: docs survive, exit 1, no unhandled rejection", async () => {
    const out = dest();
    // Headers (and the sha) are fine — the failure is in the BODY, after the alignment
    // check passed and both legs were already running.
    const { fetchImpl } = stub({
      kgBody: () =>
        new ReadableStream({
          start(c) {
            c.enqueue(bundleTarGz.subarray(0, 16));
            c.error(new Error("connection reset"));
          },
        }),
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => void unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    const s = sink();
    try {
      const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });
      // allSettled means the losing leg's rejection is OURS — never node's, which would
      // print a stack and kill the process over a network blip.
      await new Promise((r) => setImmediate(r));
      expect(code).toBe(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }

    // The leg that won keeps what it wrote — a retry re-fetches only what's missing.
    expect(readFileSync(join(out, "docs", "intro.md"), "utf8")).toBe("# Intro\n");
    expect(existsSync(join(out, "graphify-out", "graph.json"))).toBe(false);
    const err = s.err.join("");
    expect(err).toContain("Downloaded docs → 1 files ("); // the ✔ that was already earned stays
    expect(err).toContain("Fetching graph — connection reset");
    expect(err).toContain("Run the same command again to retry.");
    expect(err).not.toContain("Done in"); // no summary for a failed run
    expect(s.out).toEqual([]); // …and nothing at all on the payload stream
  });

  it("the OTHER direction: docs die, graph survives — the graph still earns its ✔", async () => {
    const out = dest();
    // codeload 500s while the bundle streams fine. The graph is genuinely on disk, so
    // reporting it as still-in-flight (or not at all) would be a lie about the filesystem.
    const { fetchImpl } = stub();
    const failing = (async (input: any, init: any) =>
      String(input).includes("codeload.github.com")
        ? new Response("nope", { status: 500 })
        : fetchImpl(input, init)) as unknown as typeof fetch;
    const s = sink();
    const code = await download("next.js", { apiBase: API, fetchImpl: failing, getToken: () => "tok", outDir: () => out, ...s.deps });

    expect(code).toBe(1);
    expect(existsSync(join(out, "graphify-out", "graph.json"))).toBe(true);
    const err = s.err.join("");
    expect(err).toContain("Fetched graph → 2,803 nodes · 2,874 edges");
    expect(err).toContain("Downloading docs — codeload fetch failed (HTTP 500)");
  });

  it("a bundle with no savings.json/meta.json still exits 0 — and prints no undefined/NaN", async () => {
    const out = dest();
    const { fetchImpl } = stub({ bundle: oldBundleTarGz });
    const s = sink();
    const code = await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });

    expect(code).toBe(0);
    const all = s.text();
    expect(all).not.toContain("undefined");
    expect(all).not.toContain("NaN");
    expect(all).not.toContain("Saved ~"); // dropped whole, not printed half-known
    // The graph step still says something true: its transferred size.
    expect(s.err.join("")).toMatch(/Fetched graph → \d+(\.\d)? (B|kB|MB)/);
    expect(s.err.join("")).toMatch(/Done in \d/);
  });

  it("not a TTY (piped / CI): not one ANSI escape byte on either stream", async () => {
    const out = dest();
    const { fetchImpl } = stub();
    const s = sink();
    await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });
    expect(s.text()).not.toContain("\x1b");
    // …and the path a script reads is bare: no spinner indent, no trailing decoration.
    expect(s.out).toEqual([out]);
  });

  it("piped stdout from a real terminal: the path stays bare even though stderr IS a tty", async () => {
    const out = dest();
    const { fetchImpl } = stub();
    // `graflet next.js | tail -1` run interactively: stdout is a pipe, stderr is STILL the
    // terminal — so the live frame is on, which is the whole point. Keying the payload's
    // formatting off stderr indented the one line a script reads, and
    // `cd "$(graflet next.js)"` failed with "no such file or directory".
    const s = sink({ isTTY: true, isStdoutTTY: false });
    await download("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", outDir: () => out, ...s.deps });

    expect(s.err.join("")).toContain("\x1b"); // the frame really did render
    expect(s.out).toEqual([out]); // …and the payload is untouched by it
    expect(s.out[0]).not.toMatch(/^\s/);
  });
});
