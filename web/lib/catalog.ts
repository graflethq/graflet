import { buildInstallCommand } from "./command";
import { round1 } from "./utils";

/**
 * The catalog view-model — the ONE seam (spec Testing Decisions). Pure map from
 * (catalog API response, active tab, search query) → the exact rendered rows:
 * sorted, filtered, with `—` for every metric the data lacks (ADR-0006 honesty —
 * never a fabricated number) and the correct install command. The table is a
 * thin renderer over this; all sort/filter/format logic lives here so it is unit
 * tested against fixture JSON, not against markup.
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
   *  research/savings-metrics/REQUIREMENTS.md). NOT yet computed (CONTEXT.md), so it
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

export function buildCatalogRows(docs: CatalogDoc[], tab: CatalogTab, query = ""): CatalogRow[] {
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
      // Passthrough; ticket 08 lands built_at and formats it (design shows "2h ago").
      updated: d.built_at ?? DASH,
      command: buildInstallCommand(d.slug),
      key: `cat-${d.slug}`,
    }));
}

/** github URL → "owner/repo" for the row's dim sub-label. */
function repoSlug(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
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
