import { describe, it, expect } from "vitest";
import {
  buildCatalogRows,
  pageWindow,
  relativeTime,
  sameSort,
  toggleSort,
  SORT_PRESETS,
  type CatalogDoc,
  type CatalogSort,
} from "./catalog";

// Fixture catalog JSON — the shape GET /catalog returns. `vitest` deliberately
// lacks graphscore / doc_tokens / nodes / built_at to exercise the
// honesty rule (each absent metric must render "—").
const DOCS: CatalogDoc[] = [
  {
    slug: "react",
    name: "react",
    license: "MIT",
    popularity_rank: 2,
    latest_version: "v19.1.0",
    hero_savings: 120000,
    doc_tokens: 1544613,
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

const [TOP_SCORED, SMALLEST, RECENT] = SORT_PRESETS.map((p) => p.sort);

const slugs = (docs: CatalogDoc[], sort: CatalogSort, q = "") =>
  buildCatalogRows(docs, sort, q).map((r) => r.slug);

describe("buildCatalogRows — sorting", () => {
  it("Top scored = GraphScore desc, missing score last", () => {
    expect(slugs(DOCS, TOP_SCORED)).toEqual(["react", "shadcn", "vitest"]);
  });

  it("Smallest first = nodes asc, missing size last", () => {
    expect(slugs(DOCS, SMALLEST)).toEqual(["shadcn", "react", "vitest"]);
  });

  it("Recently built = built_at desc, missing date last", () => {
    expect(slugs(DOCS, RECENT)).toEqual(["react", "shadcn", "vitest"]);
  });

  it("sorts every sortable column in both directions", () => {
    expect(slugs(DOCS, { key: "score", dir: "asc" })).toEqual(["shadcn", "react", "vitest"]);
    expect(slugs(DOCS, { key: "size", dir: "desc" })).toEqual(["react", "shadcn", "vitest"]);
    expect(slugs(DOCS, { key: "updated", dir: "asc" })).toEqual(["shadcn", "react", "vitest"]);
    expect(slugs(DOCS, { key: "tokens", dir: "desc" })).toEqual(["react", "shadcn", "vitest"]);
  });

  it("keeps docs missing the sorted metric last in BOTH directions", () => {
    // vitest has no graphscore/nodes/built_at — it must never lead an ascending sort.
    for (const key of ["score", "tokens", "size", "updated"] as const) {
      expect(slugs(DOCS, { key, dir: "asc" }).at(-1)).toBe("vitest");
      expect(slugs(DOCS, { key, dir: "desc" }).at(-1)).toBe("vitest");
    }
  });

  it("does not mutate the input array", () => {
    const before = DOCS.map((d) => d.slug);
    buildCatalogRows(DOCS, SMALLEST, "");
    expect(DOCS.map((d) => d.slug)).toEqual(before);
  });
});

describe("toggleSort — a fresh column starts descending, the same column flips", () => {
  it("switches column at desc, then alternates on repeat clicks", () => {
    const first = toggleSort({ key: "score", dir: "desc" }, "tokens");
    expect(first).toEqual({ key: "tokens", dir: "desc" });
    expect(toggleSort(first, "tokens")).toEqual({ key: "tokens", dir: "asc" });
    expect(toggleSort({ key: "tokens", dir: "asc" }, "tokens")).toEqual({
      key: "tokens",
      dir: "desc",
    });
  });

  it("lights the matching preset tab however the sort was set", () => {
    expect(sameSort(toggleSort({ key: "size", dir: "asc" }, "score"), TOP_SCORED)).toBe(true);
    expect(sameSort({ key: "tokens", dir: "desc" }, TOP_SCORED)).toBe(false);
  });
});

describe("pageWindow — both ends reachable, current always flanked", () => {
  it("lists every page while they fit", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the runs it skips, never the first or last page", () => {
    expect(pageWindow(1, 40)).toEqual([1, 2, "…", 40]);
    expect(pageWindow(20, 40)).toEqual([1, "…", 19, 20, 21, "…", 40]);
    expect(pageWindow(40, 40)).toEqual([1, "…", 39, 40]);
  });
});

describe("buildCatalogRows — filtering", () => {
  it("filters by library name, case-insensitively", () => {
    expect(slugs(DOCS, TOP_SCORED, "shad")).toEqual(["shadcn"]);
    expect(slugs(DOCS, TOP_SCORED, "REACT")).toEqual(["react"]);
    expect(slugs(DOCS, TOP_SCORED, "   ")).toEqual(["react", "shadcn", "vitest"]);
  });
});

describe("buildCatalogRows — honesty (missing metrics render —, never fabricated)", () => {
  it("a doc missing metrics still renders its row, with — for each gap", () => {
    const vitest = buildCatalogRows(DOCS, TOP_SCORED).find((r) => r.slug === "vitest")!;
    expect(vitest).toMatchObject({
      score: "—",
      tokens: "—",
      size: "—",
      updated: "—",
      command: "uvx graflet vitest",
    });
  });
});

describe("buildCatalogRows — present metrics render real values", () => {
  it("maps a fully-populated doc to display strings", () => {
    const react = buildCatalogRows(DOCS, TOP_SCORED).find((r) => r.slug === "react")!;
    expect(react).toMatchObject({
      name: "react",
      repo: "reactjs/react.dev",
      version: "v19.1.0",
      score: "99/100",
      tokens: "1.5M", // metric #4 — raw doc-corpus token count (1,544,613), compact
      size: "1.2k nodes · 3.9k edges",
      command: "uvx graflet react",
      key: "cat-react",
    });
  });

  it("every row's command is the latest bare command (no @version)", () => {
    for (const row of buildCatalogRows(DOCS, TOP_SCORED)) {
      expect(row.command).toBe(`uvx graflet ${row.slug}`);
    }
  });

  it("formats built_at as a freshness label relative to `now`", () => {
    // react built_at = 2026-07-20T10:00:00Z; fix `now` 3h later for a stable string.
    const now = Date.parse("2026-07-20T13:00:00Z");
    const react = buildCatalogRows(DOCS, TOP_SCORED, "", now).find((r) => r.slug === "react")!;
    expect(react.updated).toBe("3h ago");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-20T12:00:00Z");
  it("scales the unit m → h → d → w → mo → y and floors", () => {
    expect(relativeTime("2026-07-20T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-07-20T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-07-18T12:00:00Z", now)).toBe("2d ago");
    expect(relativeTime("2026-07-06T12:00:00Z", now)).toBe("2w ago");
    expect(relativeTime("2026-05-01T12:00:00Z", now)).toBe("2mo ago");
    expect(relativeTime("2024-07-20T12:00:00Z", now)).toBe("2y ago");
  });
  it("null/unparseable → —, future → just now", () => {
    expect(relativeTime(null, now)).toBe("—");
    expect(relativeTime("not-a-date", now)).toBe("—");
    expect(relativeTime("2026-07-20T12:05:00Z", now)).toBe("just now");
  });

  it("reads the pipeline's zone-less UTC stamp as UTC, not local", () => {
    // kg-pipeline state.now() → "%Y-%m-%dT%H:%M:%S.%f" (UTC, no Z). Must match the
    // Z-tagged instant, i.e. NOT be shifted by the runner's local offset.
    expect(relativeTime("2026-07-20T09:00:00.123456", now)).toBe(
      relativeTime("2026-07-20T09:00:00.123456Z", now),
    );
    // zone-less, no sub-second: exactly 3h before `now`, not skewed to local.
    expect(relativeTime("2026-07-20T09:00:00", now)).toBe("3h ago");
  });
});
