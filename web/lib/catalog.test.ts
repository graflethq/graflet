import { describe, it, expect } from "vitest";
import { buildCatalogRows, type CatalogDoc } from "./catalog";

// Fixture catalog JSON — the shape GET /catalog returns. `vitest` deliberately
// lacks graphscore / usage_token_reduction_pct / nodes / built_at to exercise the
// honesty rule (each absent metric must render "—").
const DOCS: CatalogDoc[] = [
  {
    slug: "react",
    name: "react",
    license: "MIT",
    popularity_rank: 2,
    latest_version: "v19.1.0",
    hero_savings: 120000,
    usage_token_reduction_pct: 68,
    repo_url: "https://github.com/reactjs/react.dev",
    graphscore: 99,
    nodes: 1200,
    edges: 3900,
    built_at: "2026-07-20T10:00:00Z",
  },
  {
    slug: "shadcn",
    name: "shadcn/ui",
    license: "MIT",
    popularity_rank: 5,
    latest_version: "v0.9.2",
    hero_savings: 80000,
    repo_url: "https://github.com/shadcn-ui/ui",
    graphscore: 96,
    nodes: 840,
    edges: 2400,
    built_at: "2026-07-19T10:00:00Z",
  },
  {
    slug: "vitest",
    name: "vitest",
    license: "MIT",
    popularity_rank: 8,
    latest_version: "v2.0.5",
    hero_savings: null,
    repo_url: "https://github.com/vitest-dev/vitest",
    graphscore: null,
  },
];

const slugs = (docs: CatalogDoc[], tab: Parameters<typeof buildCatalogRows>[1], q = "") =>
  buildCatalogRows(docs, tab, q).map((r) => r.slug);

describe("buildCatalogRows — sorting", () => {
  it("Popular = GraphScore desc, missing score last", () => {
    expect(slugs(DOCS, "popular")).toEqual(["react", "shadcn", "vitest"]);
  });

  it("Smallest first = nodes asc, missing size last", () => {
    expect(slugs(DOCS, "smallest")).toEqual(["shadcn", "react", "vitest"]);
  });

  it("Recently built = built_at desc, missing date last", () => {
    expect(slugs(DOCS, "recent")).toEqual(["react", "shadcn", "vitest"]);
  });

  it("does not mutate the input array", () => {
    const before = DOCS.map((d) => d.slug);
    buildCatalogRows(DOCS, "smallest", "");
    expect(DOCS.map((d) => d.slug)).toEqual(before);
  });
});

describe("buildCatalogRows — filtering", () => {
  it("filters by library name, case-insensitively", () => {
    expect(slugs(DOCS, "popular", "shad")).toEqual(["shadcn"]);
    expect(slugs(DOCS, "popular", "REACT")).toEqual(["react"]);
    expect(slugs(DOCS, "popular", "   ")).toEqual(["react", "shadcn", "vitest"]);
  });
});

describe("buildCatalogRows — honesty (missing metrics render —, never fabricated)", () => {
  it("a doc missing metrics still renders its row, with — for each gap", () => {
    const vitest = buildCatalogRows(DOCS, "popular").find((r) => r.slug === "vitest")!;
    expect(vitest).toMatchObject({
      score: "—",
      tokens: "—",
      size: "—",
      updated: "—",
      command: "npx docs-kg vitest",
    });
  });
});

describe("buildCatalogRows — present metrics render real values", () => {
  it("maps a fully-populated doc to display strings", () => {
    const react = buildCatalogRows(DOCS, "popular").find((r) => r.slug === "react")!;
    expect(react).toMatchObject({
      name: "react",
      repo: "reactjs/react.dev",
      version: "v19.1.0",
      score: "99/100",
      tokens: "~68%",
      size: "1.2k nodes · 3.9k edges",
      command: "npx docs-kg react",
      key: "cat-react",
    });
  });

  it("every row's command is the latest bare command (no @version)", () => {
    for (const row of buildCatalogRows(DOCS, "popular")) {
      expect(row.command).toBe(`npx docs-kg ${row.slug}`);
    }
  });
});
