/**
 * Internal Markdown-fetch module (ticket 04 / ADR-0002).
 *
 * NOT a user-facing command. There is no `.md`-only download — the only user
 * download is the two-source command (ticket 05) that composes this with the KG
 * broker. Given a catalog-resolved `{repo_url, sha, docs_path}` (ticket 02), this
 * pulls ONE anonymous codeload tarball of the upstream public repo pinned at that
 * immutable commit SHA, strips the top-level `{repo}-{sha}/` prefix, extracts only
 * the `docs_path` subtree, and writes the `.md` byte-for-byte as it exists upstream
 * at that SHA. No `api.github.com` call and no token, so it never spends the
 * 60/hr anonymous REST budget. The SHA is the same one the KG was built from (P1),
 * so the Markdown aligns with the KG when ticket 05 wires them together.
 */
import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export interface ResolvedSource {
  repo_url: string;
  sha: string;
  docs_path: string;
}

export interface FetchMarkdownOptions {
  fetchImpl?: typeof fetch;
}

const SHA_RE = /^[0-9a-f]{40}$/i;
const DEC = new TextDecoder();

/** Extract `{org, repo}` from a `github.com/{org}/{repo}` URL (tolerates `.git`/trailing slash). */
export function parseRepo(repoUrl: string): { org: string; repo: string } {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repoUrl.trim());
  if (!m) throw new Error(`not a GitHub repo_url: ${repoUrl}`);
  return { org: m[1], repo: m[2] };
}

/** The anonymous codeload tarball URL for a pinned commit (ADR-0002: never api.github.com). */
export function codeloadUrl(org: string, repo: string, sha: string): string {
  return `https://codeload.github.com/${org}/${repo}/tar.gz/${sha}`;
}

/**
 * Fetch the pinned upstream `.md` for a resolved source and write the `docs_path`
 * subtree under `destDir`. Returns the paths written. An unresolved/partial input
 * (e.g. the pre-P1 catalog state where `sha` is null) fails cleanly BEFORE any
 * network request — it never attempts a download.
 */
export async function fetchMarkdown(
  src: ResolvedSource,
  destDir: string,
  opts: FetchMarkdownOptions = {},
): Promise<string[]> {
  const repoUrl = (src.repo_url ?? "").trim();
  const sha = (src.sha ?? "").trim();
  const docsPath = (src.docs_path ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!repoUrl || !sha || !docsPath) {
    throw new Error("cannot fetch markdown: unresolved source (missing repo_url, sha or docs_path)");
  }
  if (!SHA_RE.test(sha)) {
    throw new Error(`cannot fetch markdown: '${sha}' is not a 40-char commit sha`);
  }
  const { org, repo } = parseRepo(repoUrl);

  const fetchImpl = opts.fetchImpl ?? fetch;
  // A bare GET — no headers means no Authorization, so no token is ever sent.
  const res = await fetchImpl(codeloadUrl(org, repo, sha));
  if (!res.ok) throw new Error(`codeload fetch failed (HTTP ${res.status}) for ${org}/${repo}@${sha}`);
  const tar = gunzipSync(new Uint8Array(await res.arrayBuffer()));

  // The archive's single top-level dir is `{repo}-{sha}/`; keep only files under
  // `{prefix}{docs_path}/`, and strip the `{repo}-{sha}/` prefix from the output.
  const prefix = `${repo}-${sha}/`;
  const subtree = `${prefix}${docsPath}/`;
  const written: string[] = [];
  for (const entry of readTar(tar)) {
    if (!entry.path.startsWith(subtree)) continue;
    const outPath = safeJoin(destDir, entry.path.slice(prefix.length));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, entry.data); // byte-for-byte, unmodified
    written.push(outPath);
  }
  return written;
}

/** Refuse any archive entry that would resolve outside `base` (path-traversal guard). */
function safeJoin(base: string, rel: string): string {
  const abs = resolve(base, rel);
  const root = resolve(base);
  if (abs !== root && !abs.startsWith(root + sep)) throw new Error(`unsafe path in archive: ${rel}`);
  return abs;
}

/**
 * Minimal tar reader for GitHub codeload archives (pax format). Yields regular
 * files only (directories/symlinks skipped), honoring both the ustar `name`+`prefix`
 * fields and pax extended-header (`x`) `path` overrides that codeload emits for long
 * paths. Not a general-purpose tar parser — just enough for a trusted codeload tarball.
 */
function* readTar(buf: Uint8Array): Generator<{ path: string; data: Uint8Array }> {
  const BLK = 512;
  let off = 0;
  let paxPath: string | null = null;
  while (off + BLK <= buf.length) {
    const h = buf.subarray(off, off + BLK);
    off += BLK;
    if (h.every((b) => b === 0)) break; // end-of-archive marker (first all-zero block)
    const size = parseInt(cstr(h, 124, 12).trim() || "0", 8);
    if (!Number.isFinite(size) || size < 0) throw new Error("corrupt tar: bad size field");
    const typeflag = String.fromCharCode(h[156] || 0x30); // NUL typeflag == regular file '0'
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / BLK) * BLK; // advance past the data, padded to a full block

    if (typeflag === "x") {
      // pax extended header: its `path` overrides the NEXT entry's name (long paths).
      const p = paxRecords(data).path;
      if (p) paxPath = p;
      continue;
    }
    if (typeflag === "g") continue; // global pax header (codeload: comment=sha only) — ignore
    if (typeflag === "0") {
      const name = cstr(h, 0, 100);
      const prefix = cstr(h, 345, 155);
      yield { path: paxPath ?? (prefix ? `${prefix}/${name}` : name), data };
    }
    paxPath = null; // reset after any real entry (or a skipped dir/symlink)
  }
}

/**
 * Parse pax extended-header records `"<len> key=value\n"`. `<len>` is the record's
 * BYTE length (counting itself), so records are sliced over the raw bytes — a
 * decoded string would mis-slice any multibyte path, the very case pax exists for.
 */
function paxRecords(data: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < data.length) {
    let sp = pos;
    while (sp < data.length && data[sp] !== 0x20) sp++; // 0x20 = space, ends the length digits
    if (sp >= data.length) break;
    const len = parseInt(DEC.decode(data.subarray(pos, sp)), 10);
    if (!(len > 0) || pos + len > data.length) break;
    const kv = DEC.decode(data.subarray(sp + 1, pos + len - 1)); // sp+1..end, dropping the trailing "\n"
    const eq = kv.indexOf("=");
    if (eq > 0) out[kv.slice(0, eq)] = kv.slice(eq + 1);
    pos += len;
  }
  return out;
}

/** Read a NUL-terminated field from a tar header. */
function cstr(b: Uint8Array, off: number, len: number): string {
  let end = off;
  while (end < off + len && b[end] !== 0) end++;
  return DEC.decode(b.subarray(off, end));
}
