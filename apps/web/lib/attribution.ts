import { repoSlug, type CatalogDoc } from "./catalog";

/**
 * The attribution view-model (ticket 07). Pure map from the catalog API response
 * → the rows the /attribution page renders: one per redistributed library, each
 * with its upstream source repo + license, sorted by name. This satisfies the
 * green-license redistribution terms (list each doc's `repo_url` + `license_id`).
 * Kept pure and unit-tested for the same reason as `buildCatalogRows` — the page
 * is a thin renderer over this.
 */

export interface AttributionRow {
  key: string;
  name: string;
  /** "owner/repo", or "" when the catalog has no repo_url. */
  repo: string;
  /** Link href for the repo, or "" when absent. */
  repoUrl: string;
  /** SPDX id like "MIT"; "none stated" when the source states no license (ADR-0012); "—" when the
   *  catalog has nothing at all (ADR-0006 honesty — never fabricate). */
  license: string;
}

const DASH = "—";
/** The source states no license — a checked fact, not a blank. Spelled out rather than shown as a
 *  dash, which would read as "we forgot to fill this in" (ADR-0012). */
const NONE_STATED = "none stated";

export function buildAttributionRows(docs: CatalogDoc[]): AttributionRow[] {
  return docs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      key: `attr-${d.slug}`,
      name: d.name,
      // the repo the bytes actually come from — the DOCS repo on a split doc (ADR-0011). This page
      // must be accurate, so it never substitutes code_repo_url the way the catalog card does.
      repo: repoSlug(d.repo_url),
      repoUrl: d.repo_url ?? "",
      license: d.license?.trim().toUpperCase() === "NONE" ? NONE_STATED : d.license || DASH,
    }));
}
