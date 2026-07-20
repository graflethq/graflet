/**
 * `docs-kg <slug>` / `docs-kg <slug>@<version>` — THE SPINE (ticket 05 / ADR-0002, 0005).
 *
 * One command, two sources. Resolves the pin from the catalog, then writes BOTH
 * the doc's Markdown and its knowledge graph to ./<slug>/ together:
 *   • .md  — fetched from the UPSTREAM public repo (ticket 04's module: one
 *            anonymous codeload tarball at the pinned sha; no token, no REST budget).
 *   • KG   — fetched from the backend broker (the ONE action needing sign-in,
 *            ADR-0005; the broker holds the private-repo token and streams bytes).
 * The two align by construction: both are keyed to the same commit sha, asserted
 * here against the broker's X-KG-Sha before the KG is written (ADR-0002).
 */

import { join } from "node:path";
import { downloadKg, resolveDoc } from "./api.js";
import { resolveToken } from "./credential-store.js";
import { extractTarGz, fetchMarkdown } from "./md-fetch.js";

export interface DownloadDeps {
  apiBase: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null;
  outDir?: (slug: string, version: string | null) => string;
  log?: (msg: string) => void;
}

/** Returns a process exit code (0 = both sources written). */
export async function download(arg: string, deps: DownloadDeps): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getToken = deps.getToken ?? (() => resolveToken());
  const log = deps.log ?? console.log;

  // Slugs have no `@`; version labels ("16", "3.4") follow it. Split on the first.
  const at = arg.indexOf("@");
  const slug = at < 0 ? arg : arg.slice(0, at);
  const version = at < 0 ? null : arg.slice(at + 1);
  if (!slug) {
    log("Usage: docs-kg <slug>[@<version>]");
    return 1;
  }

  // The gate (ADR-0005): downloading a KG is the ONE action that needs sign-in.
  const token = getToken();
  if (!token) {
    log("Downloading a KG needs a sign-in. Run `docs-kg login` first.");
    return 1;
  }

  const resolved = await resolveDoc(deps.apiBase, slug, version, fetchImpl);
  if (!resolved) {
    log(`"${slug}"${version ? `@${version}` : ""} isn't available to download yet.`);
    return 1;
  }

  const dest = (deps.outDir ?? defaultOut)(slug, version);

  // Fetch the KG bundle from the broker (auth-gated; streamed from the private
  // repo — the maintainer's key never reaches us) and verify it aligns BEFORE
  // writing anything. Alignment check (ADR-0002): the KG must be built from the
  // same sha we'll fetch the .md at — equal by construction, so a mismatch means
  // drift/bug. Checking first guarantees no `.md`-only path is ever left on disk.
  const kg = await downloadKg(deps.apiBase, token, slug, version, fetchImpl);
  if (kg.sha && kg.sha !== resolved.sha) {
    log(`Refusing to write: the KG's sha (${kg.sha}) doesn't match the docs sha (${resolved.sha}).`);
    return 1;
  }

  // Both verified — write the two sources together. .md from upstream (ticket 04,
  // anonymous, no token), then the KG bundle files.
  // ponytail: a rare IO error between these two writes could orphan one source;
  // full atomicity (temp dir + rename) is deferred — the sha-drift path ADR-0002
  // cares about is already fully guarded above.
  await fetchMarkdown(resolved, dest, { fetchImpl });
  await extractTarGz(kg.bytes, dest);

  log(`Downloaded ${slug} (${resolved.version}) to ${dest}/ — Markdown + knowledge graph.`);
  return 0;
}

function defaultOut(slug: string, version: string | null): string {
  return join(process.cwd(), version ? `${slug}@${version}` : slug);
}
