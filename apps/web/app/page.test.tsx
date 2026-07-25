import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";
import { LINKS } from "@/lib/links";

function stubEmptyCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ docs: [] }) })) as unknown as typeof fetch,
  );
}

describe("Landing page (ADR-0005: no email / marketing opt-in capture)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders no email input and no opt-in checkbox anywhere on the landing page", async () => {
    stubEmptyCatalog();

    const { container } = render(<Home />);
    // Let the catalog fetch settle (also asserts the empty state renders).
    await screen.findByText("No libraries are ready yet.");

    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe("Landing page — every outbound link points somewhere that exists", () => {
  beforeEach(stubEmptyCatalog);
  afterEach(() => vi.unstubAllGlobals());

  it("sends visitors off-site only to URLs declared in LINKS", async () => {
    // The Support card once shipped a GitHub Sponsors and a Buy Me a Coffee button
    // whose URLs had been guessed from the @graflethq handle. Neither existed —
    // one 404'd, the other had no sponsors listing — and both were live for weeks.
    // A destination invented in JSX rather than declared here fails this.
    const { container } = render(<Home />);
    await screen.findByText("No libraries are ready yet.");

    const declared = new Set<string>(Object.values(LINKS));
    const external = [...container.querySelectorAll("a[href^='http']")].map((a) => a.getAttribute("href")!);

    expect(external.length).toBeGreaterThan(0);
    for (const href of external) expect(declared).toContain(href);
  });

  it("asks for a star, and offers the one funding destination that exists", async () => {
    const { container } = render(<Home />);
    await screen.findByText("No libraries are ready yet.");

    expect(screen.getByRole("link", { name: "★ Star on GitHub" })).toHaveAttribute("href", LINKS.github);
    expect(screen.getByRole("link", { name: "Support from $10" })).toHaveAttribute("href", "/support");
    // The two that never existed stay gone (see the test above).
    expect(container.innerHTML).not.toMatch(/buymeacoffee|sponsors/i);
  });

  it("never claims there are no paid plans while linking a checkout that sells them", async () => {
    // This shipped: the Support card read "no paid plans — ever" while the nav
    // linked ten of them. Contradicting your own checkout on the page a merchant
    // reviewer lands on is a liability, not a typo. ADR-0009 settled the wording.
    const { container } = render(<Home />);
    await screen.findByText("No libraries are ready yet.");

    expect(container.textContent).not.toMatch(/no paid plans/i);
  });

  it("keeps Docs and GitHub out of the footer, like the nav", async () => {
    render(<Home />);
    await screen.findByText("No libraries are ready yet.");

    // Both were the repo, which ★ Star already opens.
    expect(screen.queryByRole("link", { name: "Docs" })).toBeNull();
    expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
    for (const name of ["Catalog", "Privacy", "Terms", "Attribution"]) {
      expect(screen.getAllByRole("link", { name }).length).toBeGreaterThan(0);
    }
  });
});
