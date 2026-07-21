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
  /** SPDX id like "MIT", or "—" when absent (ADR-0006 honesty — never fabricate). */
  license: string;
}

const DASH = "—";

export function buildAttributionRows(docs: CatalogDoc[]): AttributionRow[] {
  return docs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      key: `attr-${d.slug}`,
      name: d.name,
      repo: repoSlug(d.repo_url),
      repoUrl: d.repo_url ?? "",
      license: d.license || DASH,
    }));
}
