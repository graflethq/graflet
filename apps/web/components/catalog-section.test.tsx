import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogSection } from "./catalog-section";

function stubCatalog(docs: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ docs }) })) as unknown as typeof fetch,
  );
}

/** n docs whose only distinguishing metric is doc_tokens, so ordering is unambiguous. */
function docsWithTokens(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `lib-${i + 1}`,
    name: `lib-${i + 1}`,
    license: "MIT",
    popularity_rank: i + 1,
    latest_version: "1.0.0",
    hero_savings: null,
    repo_url: null,
    graphscore: 100 - i, // descending, so "Top scored" order is lib-1, lib-2, …
    doc_tokens: i + 1, // ascending, the inverse of the score order
  }));
}

/** The library names currently rendered, top to bottom. */
const visibleLibraries = () =>
  screen
    .getAllByRole("row")
    .slice(1) // skip the header row
    .map((r) => r.querySelector("td")?.textContent?.trim() ?? "");

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
    // GraphScore, Doc tokens, Graph size, Updated all lack data → four — cells.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    // Per-row copy — no sign-in, no KG fetch (ADR-0005).
    expect(
      screen.getByRole("button", { name: "Copy command: uvx graflet lonely" }),
    ).toBeInTheDocument();
  });
});

describe("CatalogSection — sorting (tabs and column headers share one state)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("re-sorts on a header click and dims every tab the new sort doesn't match", async () => {
    stubCatalog(docsWithTokens(3));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    // Default is the "Top scored" preset: graphscore desc.
    expect(visibleLibraries()).toEqual(["lib-1", "lib-2", "lib-3"]);
    expect(screen.getByRole("tab", { name: "Top scored" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Doc tokens ascend as the score descends, so sorting by it desc reverses the table.
    await userEvent.click(screen.getByRole("button", { name: "Sort by Doc tokens" }));

    expect(visibleLibraries()).toEqual(["lib-3", "lib-2", "lib-1"]);
    for (const name of ["Top scored", "Smallest first", "Recently built"]) {
      expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "false");
    }
  });

  it("lights the preset tab again when a header click lands back on its sort", async () => {
    stubCatalog(docsWithTokens(3));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    await userEvent.click(screen.getByRole("button", { name: "Sort by Doc tokens" }));
    await userEvent.click(screen.getByRole("button", { name: "Sort by GraphScore" }));

    // Back to graphscore desc — which IS the "Top scored" preset, however it was reached.
    expect(screen.getByRole("tab", { name: "Top scored" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("a tab click sets the sort and the matching column header shows the arrow", async () => {
    stubCatalog(docsWithTokens(3));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    await userEvent.click(screen.getByRole("tab", { name: "Recently built" }));

    expect(screen.getByRole("tab", { name: "Recently built" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("columnheader", { name: /Updated/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("flips direction when the same header is clicked twice", async () => {
    stubCatalog(docsWithTokens(3));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    await userEvent.click(screen.getByRole("button", { name: "Sort by Doc tokens" }));
    expect(visibleLibraries()).toEqual(["lib-3", "lib-2", "lib-1"]);

    await userEvent.click(screen.getByRole("button", { name: "Sort by Doc tokens" }));
    expect(visibleLibraries()).toEqual(["lib-1", "lib-2", "lib-3"]);
  });
});

describe("CatalogSection — column widths are fixed, not content-derived", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pins the layout so re-sorting cannot resize the table", async () => {
    stubCatalog(docsWithTokens(3));
    const { container } = render(<CatalogSection />);
    await screen.findByText("lib-1");

    // Without table-fixed the browser re-measures columns against whichever rows are
    // showing, so sorting "9.8k" above "1.2M" visibly resized the whole table.
    expect(container.querySelector("table")).toHaveClass("table-fixed");
    for (const name of ["GraphScore", "Doc tokens", "Graph size", "Updated"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(name) }).className).toMatch(
        /\bw-\d+\b/,
      );
    }
  });
});

describe("CatalogSection — pagination (15 per page)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the first 15 docs, then the next page's docs", async () => {
    stubCatalog(docsWithTokens(20));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    expect(visibleLibraries()).toHaveLength(15);
    expect(screen.queryByText("lib-16")).toBeNull();

    await userEvent.click(screen.getByRole("link", { name: "Go to page 2" }));

    expect(visibleLibraries()).toEqual(["lib-16", "lib-17", "lib-18", "lib-19", "lib-20"]);
    expect(screen.queryByText("lib-1")).toBeNull();
  });

  it("changes page without following the link, so the table never jumps", async () => {
    stubCatalog(docsWithTokens(20));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    await userEvent.click(screen.getByRole("link", { name: "Go to page 2" }));

    expect(screen.getByText("lib-16")).toBeInTheDocument();
    // Following the href would scroll the table back to the top on every page turn.
    expect(window.location.hash).toBe("");
  });

  it("hides the pager when everything fits on one page", async () => {
    stubCatalog(docsWithTokens(5));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    expect(screen.queryByRole("navigation", { name: "pagination" })).toBeNull();
  });

  it("returns to page 1 when the search or the sort changes", async () => {
    stubCatalog(docsWithTokens(20));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    await userEvent.click(screen.getByRole("link", { name: "Go to page 2" }));
    expect(screen.getByText("lib-16")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sort by Doc tokens" }));
    // Page 1 of the reversed order — not a stale page 2.
    expect(visibleLibraries()[0]).toBe("lib-20");
  });

  it("reports the match count next to the search box, only while searching", async () => {
    stubCatalog(docsWithTokens(20));
    render(<CatalogSection />);
    await screen.findByText("lib-1");

    // Idle: the header promise stands alone, no match count anywhere.
    expect(screen.getByText("20 libraries · more coming soon")).toBeInTheDocument();
    expect(screen.queryByText(/match/)).toBeNull();

    await userEvent.type(screen.getByLabelText("Search libraries"), "lib-2");

    // lib-2 and lib-20 both contain "lib-2".
    expect(screen.getByText("2 matches")).toBeInTheDocument();
    expect(screen.getByText("20 libraries · more coming soon")).toBeInTheDocument();
  });
});
