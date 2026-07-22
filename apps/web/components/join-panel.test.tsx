import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinPanel } from "./join-panel";

// The one ADR-critical behavior of the signup panel: the opt-in ships UNCHECKED
// (ADR-0006), the choice is carried to the backend OAuth start (never a secret in
// the browser, ADR-0001), and an already-answered user is never re-prompted.
describe("JoinPanel (ticket 06 — unchecked opt-in, no secret, no re-ask)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("ships the opt-in unchecked and carries consent=no in the sign-in link by default", async () => {
    vi.stubGlobal("fetch", vi.fn()); // sign-in is a navigation, never a fetch (ADR-0001/0005)
    render(<JoinPanel />);

    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box).not.toHaveAttribute("checked"); // no `checked` attribute in the markup (ADR-0006)

    const link = screen.getByRole("link", { name: /sign in with github/i });
    const href = link.getAttribute("href")!;
    expect(href).toContain("/auth/web/start");
    expect(href).toContain("consent=no");
    expect(href).not.toMatch(/secret/i); // no client secret ever reaches the browser
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ticking the opt-in flips the sign-in link to consent=yes", async () => {
    render(<JoinPanel />);
    const box = await screen.findByRole("checkbox");
    await userEvent.click(box);

    const href = screen.getByRole("link", { name: /sign in with github/i }).getAttribute("href")!;
    expect(href).toContain("consent=yes");
  });

  it("adopts the OAuth return fragment: stores the session, shows signed-in, and scrubs the URL", async () => {
    window.location.hash = "#login=octocat&consent=yes";
    render(<JoinPanel />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    // Persisted so a later visit isn't re-prompted; the token-free fragment is scrubbed.
    expect(JSON.parse(localStorage.getItem("graflet:session")!)).toEqual({ login: "octocat", consent: "yes" });
    expect(window.location.hash).toBe("");
  });

  it("a returning user who already answered sees no opt-in prompt", async () => {
    localStorage.setItem("graflet:session", JSON.stringify({ login: "octocat", consent: "no" }));
    render(<JoinPanel />);

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull(); // never re-asked (ADR-0006)
  });
});
