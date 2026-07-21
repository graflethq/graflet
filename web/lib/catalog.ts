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
  /** Savings metric #4 — "usage token savings", a median % reduction (spec line 74;
   *  kg-product-research/savings-metrics/REQUIREMENTS.md). NOT yet computed (CONTEXT.md), so it
   *  is absent from the API today → the Tokens saved column shows "—" until it lands. */
  usage_token_reduction_pct?: number | null;
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

export type CatalogTab = "popular" | "smallest" | "recent";

const DASH = "—";

export function buildCatalogRows(docs: CatalogDoc[], tab: CatalogTab, query = "", now = Date.now()): CatalogRow[] {
  const q = query.trim().toLowerCase();

  const sorted = docs.slice().sort((a, b) => {
    if (tab === "smallest") return numAsc(a.nodes, b.nodes);
    if (tab === "recent") return strDesc(a.built_at, b.built_at);
    return numDesc(a.graphscore, b.graphscore); // popular
  });

  return sorted
    .filter((d) => (q ? d.name.toLowerCase().includes(q) : true))
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      repo: repoSlug(d.repo_url),
      version: d.latest_version,
      score: d.graphscore == null ? DASH : `${d.graphscore}/100`,
      // Metric #4 is a "typical" % reduction — show "~N%", never a fabricated number.
      tokens: d.usage_token_reduction_pct == null ? DASH : `~${Math.round(d.usage_token_reduction_pct)}%`,
      size: d.nodes == null || d.edges == null ? DASH : `${compact(d.nodes)} nodes · ${compact(d.edges)} edges`,
      updated: relativeTime(d.built_at, now),
      command: buildInstallCommand(d.slug),
      key: `cat-${d.slug}`,
    }));
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
function compact(n: number): string {
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
