import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinPanel } from "./join-panel";
import { ANON_ID_KEY } from "@/lib/analytics";

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    set_config: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => "anon-abc"),
  },
}));
const ph = (await import("posthog-js")).default as unknown as {
  identify: ReturnType<typeof vi.fn>;
  set_config: ReturnType<typeof vi.fn>;
};

// The one ADR-critical behavior of the signup panel: the opt-in ships UNCHECKED
// (ADR-0006), the choice is carried to the backend OAuth start (never a secret in
// the browser, ADR-0001), and an already-answered user is never re-prompted.
describe("JoinPanel (ticket 06 — unchecked opt-in, no secret, no re-ask)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    ph.identify.mockClear();
    ph.set_config.mockClear();
    window.location.hash = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
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
    window.location.hash = "#login=octocat&consent=yes&github_id=4242";
    render(<JoinPanel />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    // Persisted so a later visit isn't re-prompted; the token-free fragment is scrubbed.
    expect(JSON.parse(localStorage.getItem("graflet:session")!)).toEqual({
      login: "octocat",
      consent: "yes",
      github_id: 4242,
    });
    expect(window.location.hash).toBe("");
  });

  it("identifies the person on the numeric id the moment the sign-in returns (ticket 05)", async () => {
    window.location.hash = "#login=octocat&consent=yes&github_id=4242";
    render(<JoinPanel />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    expect(ph.identify).toHaveBeenCalledWith("4242", { github_login: "octocat" });
    expect(ph.set_config).toHaveBeenCalledWith({ persistence: "localStorage+cookie" });
  });

  it("still signs in when the callback carries no github_id, it just identifies nobody", async () => {
    window.location.hash = "#login=octocat&consent=yes";
    render(<JoinPanel />);

    expect(await screen.findByText("octocat")).toBeInTheDocument();
    expect(ph.identify).not.toHaveBeenCalled();
  });

  it("parks the anonymous id before leaving for GitHub, so the trip back can merge it", async () => {
    render(<JoinPanel />);
    await userEvent.click(await screen.findByRole("link", { name: /sign in with github/i }));
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBe("anon-abc");
  });

  it("offers a pre-ticket-05 session a way back, carrying their recorded answer so nobody is re-asked", async () => {
    localStorage.setItem("graflet:session", JSON.stringify({ login: "octocat", consent: "yes" }));
    render(<JoinPanel />);

    const link = await screen.findByRole("link", { name: /reconnect your account/i });
    // Their stored answer rides through, so the server's 'unset' guard has nothing
    // to change — the opt-in box is never put in front of them again (ADR-0006).
    expect(link.getAttribute("href")).toContain("consent=yes");
    expect(screen.queryByRole("checkbox")).toBeNull();

    // Reconnecting is a sign-in leg like any other: it has to park the anonymous id
    // too, or it hands back an identity with nothing attached to it.
    await userEvent.click(link);
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBe("anon-abc");
  });

  it("does not nag a session that already carries the account id", async () => {
    localStorage.setItem("graflet:session", JSON.stringify({ login: "octocat", consent: "no", github_id: 4242 }));
    render(<JoinPanel />);

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /reconnect/i })).toBeNull();
  });

  it("a returning user who already answered sees no opt-in prompt", async () => {
    localStorage.setItem("graflet:session", JSON.stringify({ login: "octocat", consent: "no" }));
    render(<JoinPanel />);

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull(); // never re-asked (ADR-0006)
  });
});
