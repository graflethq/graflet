import type { CatalogDoc } from "./catalog";
import { round1 } from "./utils";

/**
 * The stat-tile view-model — a pure seam like `buildCatalogRows`. Maps the live
 * catalog list to the four headline tiles (spec line 77 / ticket 05 / ADR-0006):
 * every value is a real metric from a representative doc, never fabricated, and a
 * metric the catalog lacks renders "—". The design export's baked-in numbers were
 * illustrative placeholders; these are honest.
 *
 * Representative doc = the first ready doc (the list is popularity-ordered), so
 * all four tiles describe ONE real graph and stay internally consistent. Its name
 * + version is the tiles' labelled basis (see `statBasis`).
 */
export interface StatTile {
  value: string;
  label: string;
  sub: string;
}

const DASH = "—";

export function buildStatTiles(docs: CatalogDoc[]): StatTile[] {
  const rep = docs[0]; // undefined when the catalog is empty → all tiles show "—"
  return [
    {
      // hero_savings = build cost saved in USD (savings metric #1; the terminal's
      // "saved ~$0.42 in build cost"). kg-product-research/savings-metrics/REQUIREMENTS.md.
      value: rep?.hero_savings == null ? DASH : fmtUsd(rep.hero_savings),
      label: "Build cost saved",
      sub: "vs building the graph yourself",
    },
    {
      // ponytail: no build-duration field in the catalog yet → always "—"; a
      // one-line map here when the pipeline's savings pass (metric #2) exposes it.
      value: DASH,
      label: "Build time done",
      sub: "pre-computed, not on your machine",
    },
    {
      value: rep?.graphscore == null ? DASH : `${rep.graphscore}/100`,
      label: "GraphScore",
      sub: "coverage × structure quality",
    },
    {
      // Metric #4 is a median % reduction ("typical") — show "~N%", never fabricated.
      value:
        rep?.usage_token_reduction_pct == null
          ? DASH
          : `~${Math.round(rep.usage_token_reduction_pct)}%`,
      label: "Fewer tokens for your AI",
      sub: "vs feeding raw docs",
    },
  ];
}

/**
 * The representative doc's label ("next.js 16") to caption the tiles' basis — or
 * null when the catalog is empty OR the representative doc has no measured metric
 * yet. Returning null in the all-"—" case keeps the caption from citing a doc as
 * the basis for numbers that aren't there (ADR-0006 honesty).
 */
export function statBasis(docs: CatalogDoc[]): string | null {
  const rep = docs[0];
  if (!rep) return null;
  const measured =
    rep.hero_savings != null || rep.graphscore != null || rep.usage_token_reduction_pct != null;
  return measured ? `${rep.name} ${rep.latest_version}` : null;
}

/** Small USD: $0.42, $3.1, $1.2k. */
function fmtUsd(n: number): string {
  if (n >= 1000) return `$${round1(n / 1000)}k`;
  return `$${(Math.round(n * 100) / 100).toString()}`;
}
