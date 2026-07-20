import { describe, it, expect } from "vitest";
import { buildStatTiles, statBasis } from "./stats";
import type { CatalogDoc } from "./catalog";

// Representative doc = first (popularity-ordered). `next.js` has every metric;
// `react` is missing usage_token_reduction_pct + hero_savings to exercise "—".
const NEXT: CatalogDoc = {
  slug: "next.js",
  name: "next.js",
  license: "MIT",
  popularity_rank: 1,
  latest_version: "16",
  hero_savings: 0.42,
  usage_token_reduction_pct: 68,
  repo_url: "https://github.com/vercel/next.js",
  graphscore: 94,
};

const REACT: CatalogDoc = {
  slug: "react",
  name: "react",
  license: "MIT",
  popularity_rank: 2,
  latest_version: "19",
  hero_savings: null,
  repo_url: "https://github.com/reactjs/react.dev",
  graphscore: null,
};

describe("buildStatTiles (ADR-0006 honesty — real or '—', never fabricated)", () => {
  it("uses the first doc's real metrics, formatted", () => {
    const [cost, time, score, tokens] = buildStatTiles([NEXT, REACT]);
    expect(cost.value).toBe("$0.42");
    expect(score.value).toBe("94/100");
    expect(tokens.value).toBe("~68%");
    // No catalog field carries build duration yet → always "—".
    expect(time.value).toBe("—");
  });

  it("renders '—' for every metric the representative doc lacks", () => {
    const [cost, , score, tokens] = buildStatTiles([REACT]);
    expect(cost.value).toBe("—"); // hero_savings null
    expect(score.value).toBe("—"); // graphscore null
    expect(tokens.value).toBe("—"); // usage_token_reduction_pct absent
  });

  it("shows all '—' and a null basis when the catalog is empty", () => {
    expect(buildStatTiles([]).every((t) => t.value === "—")).toBe(true);
    expect(statBasis([])).toBeNull();
  });

  it("labels the basis with the representative doc's name + version", () => {
    expect(statBasis([NEXT, REACT])).toBe("next.js 16");
  });

  it("returns a null basis when the representative doc has no measured metric (honesty: don't cite a doc for an all-'—' readout)", () => {
    expect(statBasis([REACT])).toBeNull();
  });

  it("keeps the design's tile labels + sub-labels verbatim", () => {
    const tiles = buildStatTiles([]);
    expect(tiles.map((t) => t.label)).toEqual([
      "Build cost saved",
      "Build time done",
      "GraphScore",
      "Fewer tokens for your AI",
    ]);
  });

  it("formats large build-cost savings compactly", () => {
    expect(buildStatTiles([{ ...NEXT, hero_savings: 1200 }])[0].value).toBe("$1.2k");
  });
});
