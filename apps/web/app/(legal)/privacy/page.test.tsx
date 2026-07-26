import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrivacyPage from "./page";
import { ANALYTICS_OPT_OUT_KEY } from "@/lib/analytics";

/**
 * The privacy page is the one page whose only job is to be true (ADR-0010, ticket
 * 02). It previously said the site "captures nothing" and shared nothing with third
 * parties while PostHog was about to be wired in behind it. These assertions exist
 * so the page cannot quietly drift back to that: if the disclosure is deleted, this
 * fails before it reaches production.
 */
describe("Privacy page — discloses what is actually collected", () => {
  beforeEach(() => localStorage.clear());

  /** The page's rendered prose — every assertion below is about what it says. */
  const prose = () => render(<PrivacyPage />).container.textContent ?? "";

  it("names PostHog, the US, and the three identifying fields sent to it", () => {
    const text = prose();

    expect(text).toMatch(/PostHog/);
    expect(text).toMatch(/United States/);
    // Anchored to the PostHog sentence: a bare /email/ would pass off the
    // marketing-email section even if this disclosure were deleted.
    expect(text).toMatch(/keyed by your github_id, carrying your GitHub login and\s+your email/);
    expect(screen.getByRole("link", { name: /PostHog/ })).toHaveAttribute("href", "https://posthog.com/privacy");
  });

  it("discloses session recording and says typed text is masked", () => {
    const text = prose();

    expect(text).toMatch(/recorded and replayed as a video/i);
    expect(text).toMatch(/What you type is masked/i);
    // The one deliberate exception has to be stated, not buried: search terms are
    // sent on purpose, which the masking claim would otherwise contradict.
    expect(text).toMatch(/search term/i);
  });

  it("separates anonymous measurement from an identified person, and drops the old false claims", () => {
    const text = prose();

    expect(text).toMatch(/Before you sign in you are anonymous/i);
    expect(text).toMatch(/identified person/i);
    expect(text).not.toMatch(/captures nothing/i);
    expect(text).not.toMatch(/not share it with third parties/i);
  });

  it("lists every browser entry, including the ph_* ones sign-in causes", () => {
    // The first draft said "three states, and that is the whole list" and left out
    // PostHog's own keys, which appear the moment persistence turns on at sign-in
    // (ticket 05). An enumeration is only worth printing if it is exhaustive.
    const text = prose();

    expect(text).toMatch(/graflet:session/);
    expect(text).toMatch(/graflet:analytics-opt-out/);
    expect(text).toMatch(/ph_/);
    // Written the moment "Sign in with GitHub" is clicked, to carry the anonymous
    // id across the round trip to GitHub (ticket 05). It lands BEFORE sign-in
    // completes, so "before you sign in — nothing" has to account for it.
    expect(text).toMatch(/graflet:analytics-anon-id/);
  });

  it("names the third party a download actually touches, and claims no CLI telemetry that isn't there", () => {
    // packages/cli/src/md-fetch.ts pulls the docs tarball from codeload.github.com,
    // so GitHub sees the IP and the library — undisclosed, that made "the CLI talks
    // to the Graflet API and that is all" false.
    const text = prose();

    expect(text).toMatch(/codeload\.github\.com/);
    expect(text).toMatch(/The CLI sends no usage data/);
    // Until ticket 07 ships, nothing may imply CLI usage is already being measured.
    expect(text).not.toMatch(/your CLI runs are/);
  });

  it("keeps marketing consent scoped to email, not presented as covering analytics", () => {
    const text = prose();

    expect(text).toMatch(/marketing_consent/);
    expect(text).toMatch(/covers email only/i);
  });

  it("offers an opt-out that actually switches capture off, not just prose about one", async () => {
    render(<PrivacyPage />);

    const button = await screen.findByRole("button", { name: "Turn analytics off" });
    await userEvent.click(button);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe("1");
    expect(await screen.findByRole("button", { name: "Turn analytics back on" })).toBeInTheDocument();
  });

  it("offers a real delete button, and describes the two-system erasure it performs", async () => {
    const text = prose();

    // Ticket 09 replaced the "no self-serve delete button yet" wording with an
    // actual one. The page may not drift back to promising a button that isn't
    // there, nor to claiming one that is.
    expect(await screen.findByRole("link", { name: "Delete my account" })).toBeInTheDocument();
    expect(text).not.toMatch(/no self-serve delete button yet/i);
    // Both halves have to be named: deleting only our row is the failure mode
    // ADR-0010 calls out, so the page cannot describe it as if it were the job.
    expect(text).toMatch(/person PostHog holds for us/i);
    expect(screen.getAllByRole("link", { name: "graflet@rnui.dev" })[0]).toHaveAttribute(
      "href",
      "mailto:graflet@rnui.dev",
    );
  });
});
