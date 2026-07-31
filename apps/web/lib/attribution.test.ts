import { describe, it, expect } from "vitest";
import { buildAttributionRows } from "./attribution";
import type { CatalogDoc } from "./catalog";

const doc = (over: Partial<CatalogDoc>): CatalogDoc => ({
  slug: "x",
  name: "x",
  license: "MIT",
  popularity_rank: 1,
  latest_version: "v1",
  hero_savings: null,
  repo_url: null,
  graphscore: null,
  ...over,
});

describe("buildAttributionRows", () => {
  it("sorts by name and maps repo_url → owner/repo with a link href", () => {
    const rows = buildAttributionRows([
      doc({ slug: "react", name: "react", repo_url: "https://github.com/reactjs/react.dev" }),
      doc({ slug: "next", name: "next.js", repo_url: "https://github.com/vercel/next.js" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["next.js", "react"]);
    expect(rows[1]).toMatchObject({
      repo: "reactjs/react.dev",
      repoUrl: "https://github.com/reactjs/react.dev",
      license: "MIT",
    });
  });

  it("shows '—' for a missing license and empty repo for a missing repo_url", () => {
    const [row] = buildAttributionRows([doc({ slug: "a", name: "a", license: "", repo_url: null })]);
    expect(row).toMatchObject({ repo: "", repoUrl: "", license: "—" });
  });

  // ADR-0012 — "the source states no license" is a checked fact; a dash would read as an oversight.
  it("spells out 'none stated' for a source with no license", () => {
    const [row] = buildAttributionRows([doc({ slug: "a", name: "a", license: "NONE" })]);
    expect(row.license).toBe("none stated");
  });

  // ADR-0011 — this page credits where the bytes come from, so a split doc shows the DOCS repo
  // even though the catalog card shows the library.
  it("credits the docs repo, not code_repo_url, on a split doc", () => {
    const [row] = buildAttributionRows([
      doc({
        slug: "tauri",
        name: "Tauri",
        repo_url: "https://github.com/tauri-apps/tauri-docs",
        code_repo_url: "https://github.com/tauri-apps/tauri",
      }),
    ]);
    expect(row).toMatchObject({ repo: "tauri-apps/tauri-docs", repoUrl: "https://github.com/tauri-apps/tauri-docs" });
  });
});
