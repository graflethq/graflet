/**
 * `graflet <slug>` / `graflet <slug>@<version>` — THE SPINE (ticket 05 / ADR-0002, 0005).
 *
 * One command, two sources. Resolves the pin from the catalog, then writes BOTH
 * the doc's Markdown and its knowledge graph to ./<slug>/, each in its own place:
 *   • .md  — fetched from the UPSTREAM public repo (ticket 04's module: one
 *            anonymous codeload tarball at the pinned sha; no token, no REST budget),
 *            written at the root of ./<slug>/.
 *   • KG   — fetched from the backend broker (the ONE action needing sign-in,
 *            ADR-0005; the broker holds the private-repo token and streams bytes),
 *            written under ./<slug>/graphify-out/ — the same folder name graphify
 *            itself writes, so re-running graphify over the docs is a no-surprise
 *            operation. Keeping the two apart also stops the bundle's own
 *            GRAPH_REPORT.md from being indistinguishable from a doc .md to any
 *            `**\/*.md` glob (including this engine's own null-docs_path rule).
 * The two align by construction: both are keyed to the same commit sha, asserted
 * here against the broker's X-KG-Sha before the KG is written (ADR-0002).
 *
 * The two legs run CONCURRENTLY behind the stepped display in progress.ts: ~40 MB of
 * codeload plus a bundle is ~30 seconds, and a silent 30 seconds reads as a hang.
 * ADR-0002 survives the concurrency because the alignment check runs on the KG
 * response HEADERS — `openKg` returns before the body is drained, and nothing at all
 * is written until the shas match, so a mismatch still leaves NOTHING on disk.
 *
 * Streams: STDOUT carries exactly ONE line, and only on success — the absolute destination
 * path — so `cd "$(graflet react)"` works with no parsing and no `tail`. Everything a human
 * reads (header, live frame, closing summary, every error) goes to STDERR. The two streams
 * redirect independently, so a message that belongs to the reader must never ride on the
 * stream a script is capturing.
 */

import { readFile, rename } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { openKg, resolveDoc } from "./api.js";
import { resolveToken } from "./credential-store.js";
import { extractTarGz, fetchMarkdown } from "./md-fetch.js";
import { formatBytes, formatCount, formatDuration, startProgress } from "./progress.js";

export interface DownloadDeps {
  apiBase: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null;
  outDir?: (slug: string, version: string | null) => string;
  /** STDOUT sink. Receives ONE line, on success only: the absolute destination path. */
  log?: (msg: string) => void;
  /** STDERR sink: header, progress display, closing summary, errors, retry hint.
   *  Injected so tests can read them. */
  writeErr?: (chunk: string) => void;
  /** Defaults to `process.stderr.isTTY` — governs the DISPLAY, which lives on stderr.
   *  Injected rather than sniffed inside, so a test never depends on how the runner
   *  happened to wire its streams. */
  isTTY?: boolean;
  /** Defaults to `process.stdout.isTTY` — governs ONLY whether the final path line is
   *  indented for a human. A separate flag because `graflet react | tail -1` from a real
   *  terminal leaves stderr a TTY while stdout is a pipe: one flag cannot answer both, and
   *  indenting there would hand a script a path with two leading spaces. */
  isStdoutTTY?: boolean;
}

/** Returns a process exit code (0 = both sources written). */
export async function download(arg: string, deps: DownloadDeps): Promise<number> {
  const startedAt = Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getToken = deps.getToken ?? (() => resolveToken());
  const log = deps.log ?? console.log;
  const writeErr = deps.writeErr ?? ((chunk: string) => void process.stderr.write(chunk));
  const isTTY = deps.isTTY ?? process.stderr.isTTY === true;
  const isStdoutTTY = deps.isStdoutTTY ?? process.stdout.isTTY === true;
  /** One line for the reader. Everything except the final path goes through here. */
  const say = (msg: string) => writeErr(`${msg}\n`);

  // Slugs have no `@`; version labels ("16", "3.4") follow it. Split on the first.
  const at = arg.indexOf("@");
  const slug = at < 0 ? arg : arg.slice(0, at);
  const version = at < 0 ? null : arg.slice(at + 1);
  if (!slug) {
    say("Usage: graflet <slug>[@<version>]");
    return 1;
  }

  // The gate (ADR-0005): downloading a KG is the ONE action that needs sign-in.
  const token = getToken();
  if (!token) {
    say("Downloading a KG needs a sign-in. Run `graflet login` first.");
    return 1;
  }

  const resolved = await resolveDoc(deps.apiBase, slug, version, fetchImpl);
  if (!resolved) {
    say(`"${slug}"${version ? `@${version}` : ""} isn't available to download yet.`);
    return 1;
  }

  const dest = (deps.outDir ?? defaultOut)(slug, version);

  // Header, deliberately RELATIVE and short: it is read at a glance while the bars run,
  // and the absolute path is printed once at the end where a script can pick it up.
  say(`graflet · ${slug} → ./${basename(dest)}/`);

  // Open the KG stream from the broker (auth-gated; streamed from the private repo — the
  // maintainer's key never reaches us). `openKg` resolves on HEADERS ONLY, so the sha can
  // be checked before a single byte lands. Alignment check (ADR-0002): the KG must be built
  // from the same sha we'll fetch the .md at — equal by construction, so a mismatch means
  // drift/bug. Checking here, before either leg starts, is what keeps "a mismatch leaves
  // nothing on disk" true even though the two legs now download at the same time.
  const kg = await openKg(deps.apiBase, token, slug, version, fetchImpl);
  if (kg.sha && kg.sha !== resolved.sha) {
    say(`Refusing to write: the KG's sha (${kg.sha}) doesn't match the docs sha (${resolved.sha}).`);
    return 1;
  }

  // A breathing line between the header and the live frame. TTY-only: piped output is a
  // file, and a file does not want decoration.
  if (isTTY) writeErr("\n");

  // "Resolving <version>" rather than "Resolved": progress.ts derives the past tense from
  // the label (`-ing` → `-ed`), so this is how the finished line reads as
  // "✔ Resolved latest → 2f9d939 · docs and graph aligned" — one line, no separate
  // "Aligned to release" step, because the check that just passed IS the resolve.
  const p = startProgress(
    [
      { id: "resolve", label: `Resolving ${resolved.version}` },
      { id: "docs", label: "Downloading docs" },
      { id: "graph", label: "Fetching graph" },
    ],
    { isTTY, write: writeErr },
  );
  // try/finally, not a bare call: stop() is what restores the cursor and unhooks SIGINT, so
  // ANY throw in here (a rename hitting EPERM/EISDIR, say) must not exit the process leaving
  // the user at a shell with an invisible cursor. stop() is idempotent, so the explicit calls
  // below still own the ORDER — this only guarantees it happens.
  try {
    p.finish("resolve", `${resolved.sha.slice(0, 7)} · docs and graph aligned`);

    // Both legs at once. The counters live out here because the completed lines quote the
    // total transferred, and `onProgress` is the only place that number exists — neither
    // leg's return value carries it (fetchMarkdown returns paths, read() returns the tarball
    // whose gzipped size is the graph leg's own fallback detail).
    let docsBytes = 0;
    let graphBytes = 0;
    const bundleDir = join(dest, "graphify-out");
    p.begin("docs");
    p.begin("graph");

    // Each leg marks ITSELF the instant it settles, win or lose. Deferring that to after the
    // allSettled below would mean a leg that died at t=1s keeps drawing a live spinner over a
    // frozen bar until the OTHER leg finishes ~30s later — the exact "is this hung?" signal
    // this whole display exists to remove. Both re-throw so allSettled still sees the failure.
    const docsLeg = fetchMarkdown(resolved, dest, {
      fetchImpl,
      onProgress: (done, total) => {
        docsBytes = done;
        p.update("docs", done, total);
      },
    }).then(
      (files) => p.finish("docs", `${files.length} files (${formatBytes(docsBytes)})`),
      (err) => {
        p.fail("docs", message(err));
        throw err;
      },
    );

    const graphLeg = kg
      .read((done, total) => {
        graphBytes = done;
        p.update("graph", done, total);
      })
      .then(async (bytes) => {
        const written = await extractTarGz(bytes, bundleDir);
        // The closing numbers come from the bundle itself — both files are on disk by now, so
        // this costs no network call. Read INSIDE the leg so the ✔ lands the moment the graph
        // is genuinely written, even if the docs leg goes on to fail. Every read is
        // best-effort: bundles built before savings.json existed simply lack it, and any
        // single field inside may be absent. Missing means the line is DROPPED, never printed
        // as "undefined" or "NaN".
        const meta = await readJson(join(bundleDir, "meta.json"));
        const savings = await readJson(join(bundleDir, "savings.json"));
        // meta.json is the graph's own header and is authoritative; savings.structure is the
        // same pair recomputed by the cost report. A bundle with neither still says something
        // true — how much arrived.
        const nodes = num(meta, "nodes") ?? num(savings, "structure", "nodes");
        const edges = num(meta, "edges") ?? num(savings, "structure", "edges");
        p.finish(
          "graph",
          nodes !== null && edges !== null
            ? `${formatCount(nodes)} nodes · ${formatCount(edges)} edges`
            : formatBytes(graphBytes),
        );
        return { written, savings };
      })
      .catch((err: unknown) => {
        p.fail("graph", message(err));
        throw err;
      });

    // allSettled, not all: with `all`, the loser's rejection is nobody's — an unhandled
    // rejection kills the process with a stack trace, over a network blip we already report.
    // ponytail: a rare IO error between the two legs can still orphan one source; full
    // atomicity (temp dir + rename) is deferred — the sha-drift path ADR-0002 cares about is
    // guarded above, and a re-run overwrites in place.
    const [docsRes, graphRes] = await Promise.allSettled([docsLeg, graphLeg]);

    if (docsRes.status === "rejected" || graphRes.status === "rejected") {
      p.stop(); // flush the frame BEFORE the hint, so the hint reads as the last word
      // Whatever landed STAYS. Both legs are idempotent overwrites, so the retry is genuinely
      // "the same command again" — and deleting a half-download is how you lose the 30 MB that
      // did arrive.
      writeErr(`\nRun the same command again to retry.\nPartial files left in ./${basename(dest)}/\n`);
      return 1;
    }
    const { written, savings } = graphRes.value;

    // The doc's own LICENSE/NOTICE travels INSIDE the bundle (kg-pipeline surfaces it from the
    // upstream repo root — ENG-0003, for attribution-encumbered builders). It licenses the docs,
    // not the graph, so lift it back to the root where the docs are. Matches the hyphenated forms
    // real repos ship (LICENSE-APACHE + LICENSE-MIT, LICENSE-DOCS.md) — same rule as fetch.py's
    // _is_license. A repo with no pinned docs_path already had this file fetched to the root; the
    // rename lands the identical bytes on it.
    // (loop var renamed off `p` only because `p` is now the progress handle.)
    for (const file of written) {
      const name = basename(file);
      if (/^(LICENSE|COPYING|NOTICE)\b/i.test(name)) await rename(file, join(dest, name));
    }
    p.stop();

    say(`Done in ${formatDuration((Date.now() - startedAt) / 1000)}`);
    const localSeconds = num(savings, "local_time", "estimated_total_seconds");
    const costUsd = num(savings, "build_cost", "build_cost_usd");
    // The whole point of the product in one line — but only when the bundle actually knows
    // both halves. Half a claim is worse than none.
    if (localSeconds !== null && costUsd !== null) {
      say(`Saved ~${formatDuration(localSeconds)} of local build · ~$${costUsd.toFixed(2)} in API cost`);
    }
    if (isTTY) writeErr("\n"); // breathing room above the path, on the stream that owns decoration

    // THE payload, and the only thing on stdout. Indented for a human reading a terminal;
    // bare the moment stdout is a pipe or a file, so `cd "$(graflet react)"` gets a path and
    // not a path with two leading spaces. Keyed on STDOUT's own tty-ness, never stderr's.
    log(isStdoutTTY ? `  ${resolve(dest)}` : resolve(dest));
    return 0;
  } finally {
    p.stop();
  }
}

function defaultOut(slug: string, version: string | null): string {
  return join(process.cwd(), version ? `${slug}@${version}` : slug);
}

/** A rejection as the one line a user should read. Non-Error throws are stringified. */
function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

type Json = Record<string, unknown>;

/** Absent file, unreadable file, truncated JSON — all the same answer here: no numbers,
 *  not a crash. An older bundle missing savings.json is normal, not an error. */
async function readJson(path: string): Promise<Json> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Json) : {};
  } catch {
    return {};
  }
}

/** The finite number at `obj.a.b`, or null. Anything else (missing, null, string, NaN)
 *  is null so the caller drops the line instead of formatting a non-number. */
function num(obj: Json, ...path: string[]): number | null {
  let cur: unknown = obj;
  for (const key of path) {
    cur = typeof cur === "object" && cur !== null ? (cur as Json)[key] : undefined;
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : null;
}
