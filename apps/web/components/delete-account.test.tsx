import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccount } from "./delete-account";
import { SESSION_KEY } from "@/lib/session";

vi.mock("posthog-js", () => ({
  default: { __loaded: true, capture: vi.fn(), identify: vi.fn(), set_config: vi.fn(), reset: vi.fn() },
}));
const ph = (await import("posthog-js")).default as unknown as {
  reset: ReturnType<typeof vi.fn>;
  set_config: ReturnType<typeof vi.fn>;
};

const signedIn = () =>
  localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "no", github_id: 4242 }));

/** Land on /privacy the way the OAuth callback does: token in the URL fragment. */
const arriveWithToken = (token = "one-time-token") => {
  window.location.hash = `#delete_token=${token}&login=octocat`;
};

async function typeConfirmAndDelete() {
  await userEvent.type(await screen.findByRole("textbox"), "DELETE");
  await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
}

describe("DeleteAccount (ticket 09 — two-system erasure, confirmed on return)", () => {
  beforeEach(() => {
    localStorage.clear();
    ph.reset.mockClear();
    ph.set_config.mockClear();
    window.location.hash = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("starts with a GitHub round trip and deletes nothing on the way out", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<DeleteAccount />);

    const link = await screen.findByRole("link", { name: "Delete my account" });
    const href = link.getAttribute("href")!;
    expect(href).toContain("/auth/web/start");
    expect(href).toContain("intent=delete");
    // The dangerous half must not be reachable from this step: a link that deleted
    // on its own would be a one-click account wipe, since GitHub re-authorizes an
    // already-approved app with no interaction.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Delete everything" })).not.toBeInTheDocument();
  });

  it("asks for a typed confirmation before it will spend the token", async () => {
    vi.stubGlobal("fetch", vi.fn());
    arriveWithToken();
    render(<DeleteAccount />);

    const button = await screen.findByRole("button", { name: "Delete everything" });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "delete"); // wrong case
    expect(button).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("scrubs the one-time token out of the address bar on arrival", async () => {
    vi.stubGlobal("fetch", vi.fn());
    arriveWithToken();
    render(<DeleteAccount />);

    await screen.findByRole("button", { name: "Delete everything" });
    expect(window.location.hash).not.toContain("delete_token");
  });

  it("posts the token, then clears the session AND the PostHog person", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);
    signedIn();
    arriveWithToken();
    render(<DeleteAccount />);
    await typeConfirmAndDelete();

    expect(await screen.findByText(/Your account has been deleted/i)).toBeInTheDocument();
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ token: "one-time-token" });
    // Both, or the next page view recreates a person for the account just erased.
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(ph.reset).toHaveBeenCalled();
    expect(ph.set_config).toHaveBeenCalledWith({ persistence: "memory" });
  });

  it("shows a failed deletion instead of claiming one, and lets it be retried", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "deletion did not complete" }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);
    signedIn();
    arriveWithToken();
    render(<DeleteAccount />);
    await typeConfirmAndDelete();

    expect(await screen.findByText(/deletion did not complete/i)).toBeInTheDocument();
    // Nothing local may be thrown away on a failure — the account still exists.
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(ph.reset).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    expect(await screen.findByText(/Your account has been deleted/i)).toBeInTheDocument();
  });
});
