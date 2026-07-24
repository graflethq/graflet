import { compact, type CatalogDoc } from "./catalog";
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
      // Metric #2 — estimated seconds to build this graph on a local M1 model, from the catalog.
      value: rep?.build_seconds == null ? DASH : fmtDuration(rep.build_seconds),
      label: "Build time done",
      sub: "pre-computed, not on your machine",
    },
    {
      value: rep?.graphscore == null ? DASH : `${rep.graphscore}/100`,
      label: "GraphScore",
      sub: "coverage × structure quality",
    },
    {
      // Metric #4 — the raw token count of the source docs this graph distills (Anthropic-counted).
      value: rep?.doc_tokens == null ? DASH : `${compact(rep.doc_tokens)} tokens`,
      label: "Docs distilled",
      sub: "of source docs, condensed into one graph",
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
    rep.hero_savings != null || rep.graphscore != null || rep.doc_tokens != null || rep.build_seconds != null;
  return measured ? `${rep.name} ${rep.latest_version}` : null;
}

/** Build seconds → a short human duration for the tile: "42m", "19h", "2.9d". Rounded — this is an
 *  extrapolated estimate, never presented as exact. */
function fmtDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins}m`;
  const hours = Math.round(seconds / 3600);
  if (hours < 48) return `${hours}h`;
  return `${round1(seconds / 86400)}d`;
}

/** Small USD: $0.42, $3.1, $1.2k. */
function fmtUsd(n: number): string {
  if (n >= 1000) return `$${round1(n / 1000)}k`;
  return `$${(Math.round(n * 100) / 100).toString()}`;
}
