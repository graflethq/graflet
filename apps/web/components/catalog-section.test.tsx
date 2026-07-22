import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogSection } from "./catalog-section";

function stubCatalog(docs: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ docs }) })) as unknown as typeof fetch,
  );
}

describe("CatalogSection (ADR-0006: a doc missing a metric still renders, showing —)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders a row for a doc missing every metric, with — for each gap and a copy button", async () => {
    stubCatalog([
      {
        slug: "lonely",
        name: "lonely",
        license: "MIT",
        popularity_rank: 1,
        latest_version: "v1.0.0",
        hero_savings: null,
        repo_url: null,
        graphscore: null,
      },
    ]);

    render(<CatalogSection />);

    expect(await screen.findByText("lonely")).toBeInTheDocument();
    // GraphScore, Tokens saved, Graph size, Updated all lack data → four — cells.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    // Per-row copy — no sign-in, no KG fetch (ADR-0005).
    expect(
      screen.getByRole("button", { name: "Copy command: npx docs-kg lonely" }),
    ).toBeInTheDocument();
  });
});
