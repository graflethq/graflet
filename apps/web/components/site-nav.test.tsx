import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteNav } from "./site-nav";
import { SESSION_KEY } from "@/lib/session";

/** GET /stars answering `stars`. null = the backend couldn't reach GitHub. */
function stubStars(stars: number | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ stars }) })) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  localStorage.clear();
  stubStars(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("SiteNav — ★ Star is the only GitHub affordance", () => {
  it("carries no Docs or GitHub link — both pointed at the repo Star already opens", async () => {
    render(<SiteNav />);
    await screen.findByRole("link", { name: "Star graflet on GitHub" });

    expect(screen.queryByRole("link", { name: "Docs" })).toBeNull();
    expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
    // Catalog survives — it's the one link that goes somewhere else. Root-relative
    // now that the nav also renders on /support, where a bare "#catalog" is dead.
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute("href", "/#catalog");
  });

  it("links Support at the support page", async () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  });

  it("points Star at the repo", async () => {
    render(<SiteNav />);
    expect(await screen.findByRole("link", { name: "Star graflet on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/graflethq/graflet",
    );
  });
});

describe("SiteNav — the star count only appears once it's worth showing", () => {
  it("shows a count at the floor", async () => {
    stubStars(10);
    render(<SiteNav />);
    expect(await screen.findByText("10")).toBeInTheDocument();
  });

  it("hides a count below the floor — '★ Star 9' is worse than no number", async () => {
    stubStars(9);
    render(<SiteNav />);
    await screen.findByRole("link", { name: "Star graflet on GitHub" });
    await waitFor(() => expect(screen.queryByText("9")).toBeNull());
  });

  it("renders no count when the backend couldn't reach GitHub", async () => {
    stubStars(null);
    render(<SiteNav />);
    const star = await screen.findByRole("link", { name: "Star graflet on GitHub" });
    await waitFor(() => expect(star.textContent).toBe("★Star"));
  });

  it("abbreviates a big count", async () => {
    stubStars(1247);
    render(<SiteNav />);
    expect(await screen.findByText("1.2k")).toBeInTheDocument();
  });
});

describe("SiteNav — the account slot", () => {
  it("shows the sign-in button when nobody is signed in", async () => {
    render(<SiteNav />);
    expect(await screen.findByRole("link", { name: "Sign in with GitHub" })).toHaveAttribute(
      "href",
      "/join",
    );
  });

  it("shows the login instead of the sign-in button once signed in", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "no" }));
    render(<SiteNav />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in with GitHub" })).toBeNull();
  });

  it("the prerendered HTML reserves the slot instead of guessing a state", () => {
    // This is the markup Cloudflare serves before any JS runs, and localStorage is
    // unreadable at that point. Shipping the signed-out button would flash "Sign in
    // with GitHub" at a signed-in visitor on every load; shipping nothing would jump
    // the bar. So the slot is reserved, hidden, and announced to no one.
    const html = renderToStaticMarkup(<SiteNav />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="invisible"');
    // Star has no count yet either — the fetch hasn't happened, so the label is
    // the last thing inside the link.
    expect(html).toContain(">Star</span></a>");
  });

  it("signs out: clears the stored session and puts the sign-in button back", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "yes" }));
    render(<SiteNav />);

    await userEvent.click(await screen.findByRole("button", { name: /Account menu for octocat/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await screen.findByRole("link", { name: "Sign in with GitHub" })).toBeInTheDocument();
  });

  it("the menu's Account item goes to /join, which shows the consent state", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "yes" }));
    render(<SiteNav />);

    await userEvent.click(await screen.findByRole("button", { name: /Account menu for octocat/ }));
    expect(await screen.findByRole("menuitem", { name: "Account" })).toHaveAttribute("href", "/join");
  });
});
