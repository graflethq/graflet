import { buildInstallCommand } from "./command";
import { round1 } from "./utils";

/**
 * The catalog view-model — the ONE seam (spec Testing Decisions). Pure map from
 * (catalog API response, active tab, search query, now) → the exact rendered rows:
 * sorted, filtered, with `—` for every metric the data lacks (ADR-0006 honesty —
 * never a fabricated number) and the correct install command. `now` is an injected
 * clock (default `Date.now()`) so the "Updated" freshness labels are deterministic
 * under test. The table is a thin renderer over this; all sort/filter/format logic
 * lives here so it is unit tested against fixture JSON, not against markup.
 */

/** A doc as GET /catalog returns it. graphscore + repo_url come from the list;
 *  nodes/edges/built_at are filled by ticket 08 (undefined/null until then). */
export interface CatalogDoc {
  slug: string;
  name: string;
  license: string;
  popularity_rank: number;
  latest_version: string;
  hero_savings: number | null;
  repo_url: string | null;
  graphscore: number | null;
  /** Savings metric #4 — the raw token count of the whole source-doc corpus (all `.md`), the
   *  Anthropic-counted `doc_tokens` from the bundle's savings.json. It's the size of the docs this
   *  graph distills; the "Doc tokens" column / "Docs distilled" tile show it, "—" until a build lands. */
  doc_tokens?: number | null;
  /** Savings metric #2 — estimated seconds to build this graph yourself on a local M1 model
   *  (Qwen3.5-9B, extrapolated from the on-device benchmark). Feeds the "Build time done" tile. */
  build_seconds?: number | null;
  nodes?: number | null;
  edges?: number | null;
  built_at?: string | null;
}

/** A rendered table row: display strings ready to drop into cells. */
export interface CatalogRow {
  slug: string;
  name: string;
  repo: string;
  version: string;
  score: string;
  tokens: string;
  size: string;
  updated: string;
  command: string;
  key: string;
}

/** The four sortable columns. Library/Version/Command are inert: a version string
 *  orders "0.128.0" before "16" before "latest", which means nothing to a reader. */
export type SortKey = "score" | "tokens" | "size" | "updated";
export type SortDir = "asc" | "desc";
export interface CatalogSort {
  key: SortKey;
  dir: SortDir;
}

/** The tabs are named shortcuts INTO the sort state, not a second mechanism — a tab
 *  lights up whenever the sort matches its preset, whether a tab or a column header
 *  set it. So the arrows and the tabs can never disagree. */
export const SORT_PRESETS = [
  { label: "Top scored", sort: { key: "score", dir: "desc" } },
  { label: "Smallest first", sort: { key: "size", dir: "asc" } },
  { label: "Recently built", sort: { key: "updated", dir: "desc" } },
] as const satisfies readonly { label: string; sort: CatalogSort }[];

export const DEFAULT_SORT: CatalogSort = { key: "score", dir: "desc" };

/** Rows per page (grill decision). */
export const PAGE_SIZE = 15;

export const sameSort = (a: CatalogSort, b: CatalogSort) => a.key === b.key && a.dir === b.dir;

/** Descending is the useful first click for every sortable column here — best score,
 *  biggest corpus, largest graph, most recent — so a fresh column starts there. */
export function toggleSort(current: CatalogSort, key: SortKey): CatalogSort {
  if (current.key !== key) return { key, dir: "desc" };
  return { key, dir: current.dir === "desc" ? "asc" : "desc" };
}

const DASH = "—";

export function buildCatalogRows(
  docs: CatalogDoc[],
  sort: CatalogSort,
  query = "",
  now = Date.now(),
): CatalogRow[] {
  const q = query.trim().toLowerCase();

  const sorted = docs.slice().sort((a, b) => compareDocs(a, b, sort));

  return sorted
    .filter((d) => (q ? d.name.toLowerCase().includes(q) : true))
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      repo: repoSlug(d.repo_url),
      version: d.latest_version,
      score: d.graphscore == null ? DASH : `${d.graphscore}/100`,
      // Metric #4 — the raw doc-corpus token count this graph distills, shown compact (954k).
      tokens: d.doc_tokens == null ? DASH : compact(d.doc_tokens),
      size: d.nodes == null || d.edges == null ? DASH : `${compact(d.nodes)} nodes · ${compact(d.edges)} edges`,
      updated: relativeTime(d.built_at, now),
      command: buildInstallCommand(d.slug),
      key: `cat-${d.slug}`,
    }));
}

/** Sort two docs by the active column. `built_at` compares as an ISO string (which
 *  sorts chronologically); the rest are plain numbers. Missing values sort last in
 *  BOTH directions — a doc with no score is never "the best" (ADR-0006). */
function compareDocs(a: CatalogDoc, b: CatalogDoc, { key, dir }: CatalogSort): number {
  if (key === "updated") {
    return dir === "desc" ? strDesc(a.built_at, b.built_at) : strAsc(a.built_at, b.built_at);
  }
  const pick =
    key === "score"
      ? (d: CatalogDoc) => d.graphscore
      : key === "tokens"
        ? (d: CatalogDoc) => d.doc_tokens
        : (d: CatalogDoc) => d.nodes;
  return dir === "desc" ? numDesc(pick(a), pick(b)) : numAsc(pick(a), pick(b));
}

/**
 * The page numbers to render, with "…" standing in for the runs we skip. Both ends
 * are always reachable and the current page always has a neighbour on each side, so
 * a 40-page catalog still renders as a short strip.
 */
export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);

  return out;
}

/** github URL → "owner/repo" for the row's dim sub-label. Shared with the
 *  attribution page (ticket 07), which lists the same upstream repos. */
export function repoSlug(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
}

/** ISO build time → freshness label the design shows ("3h ago", "2d ago", "1w ago").
 *  Null/unparseable → "—" (honesty rule). A future stamp clamps to "just now".
 *  The pipeline stores built_at as UTC with no zone marker (kg-pipeline state.now(),
 *  "%Y-%m-%dT%H:%M:%S.%f"). `Date.parse` reads an unmarked stamp as LOCAL, which would
 *  skew the label by the viewer's offset — so treat a zone-less stamp as the UTC it is. */
export function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return DASH;
  const hasZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso);
  const then = Date.parse(hasZone ? iso : `${iso}Z`);
  if (Number.isNaN(then)) return DASH;
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** 840 → "840", 2100 → "2.1k", 3_900_000 → "3.9M". */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${round1(n / 1000)}k`;
  return `${round1(n / 1_000_000)}M`;
}

// Sort comparators — null/undefined always sort last, whatever the direction.
function nullsLast<T>(cmp: (a: T, b: T) => number) {
  return (a: T | null | undefined, b: T | null | undefined): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return cmp(a, b);
  };
}

const numDesc = nullsLast<number>((a, b) => b - a);
const numAsc = nullsLast<number>((a, b) => a - b);
const strDesc = nullsLast<string>((a, b) => (a < b ? 1 : a > b ? -1 : 0));
const strAsc = nullsLast<string>((a, b) => (a < b ? -1 : a > b ? 1 : 0));
