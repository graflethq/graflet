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
});
