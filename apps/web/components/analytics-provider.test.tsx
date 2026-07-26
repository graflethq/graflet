import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ANALYTICS_OPT_OUT_KEY, ANON_ID_KEY } from "@/lib/analytics";
import { SESSION_KEY } from "@/lib/session";

// The real SDK would open a websocket-ish request queue on init; the whole point
// of these tests is *whether* init happens, so a stub is enough.
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    __loaded: false,
    has_opted_out_capturing: vi.fn(() => false),
    clear_opt_in_out_capturing: vi.fn(),
    identify: vi.fn(),
    set_config: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => "anon-abc"),
  },
}));
const posthog = (await import("posthog-js")).default as unknown as {
  init: ReturnType<typeof vi.fn>;
  __loaded: boolean;
  has_opted_out_capturing: ReturnType<typeof vi.fn>;
  clear_opt_in_out_capturing: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  set_config: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  get_distinct_id: ReturnType<typeof vi.fn>;
};

const KEY = "phc_test_token";
const initOptions = () => posthog.init.mock.calls[0][1];

beforeEach(() => {
  posthog.init.mockClear();
  posthog.clear_opt_in_out_capturing.mockClear();
  posthog.identify.mockClear();
  posthog.set_config.mockClear();
  posthog.has_opted_out_capturing.mockReturnValue(false);
  posthog.__loaded = false;
  localStorage.clear();
  sessionStorage.clear();
  delete (window as { posthog?: unknown }).posthog;
});

afterEach(() => vi.unstubAllEnvs());

describe("AnalyticsProvider", () => {
  it("stays inert when the project token is absent (local dev, and vitest)", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    render(<AnalyticsProvider />);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("skips init entirely when this browser opted out", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    render(<AnalyticsProvider />);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("initialises anonymously, through the proxy host, with replay + exceptions on", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://edge.graflet.rnui.dev");
    render(<AnalyticsProvider />);

    expect(posthog.init).toHaveBeenCalledOnce();
    const [token, options] = posthog.init.mock.calls[0];
    expect(token).toBe(KEY);
    expect(options).toMatchObject({
      api_host: "https://edge.graflet.rnui.dev",
      ui_host: "https://us.posthog.com",
      // Anonymous by default: nothing on the visitor's device, no person row.
      persistence: "memory",
      person_profiles: "identified_only",
      // A route change is not a document load — without this every page but the first is uncounted.
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      enable_heatmaps: true,
      autocapture: true,
      rageclick: true,
      disable_session_recording: false,
      external_scripts_inject_target: "head",
    });
    // The dated defaults bundle must stay off: from '2026-01-30' it enables
    // `internal_or_test_user_hostname`, which creates a person row for an
    // anonymous localhost visitor — the opposite of `identified_only`.
    expect(options).not.toHaveProperty("defaults");
    // Replay's own masking must stay on — search terms come from ticket 04's event, not the video.
    expect(options).not.toHaveProperty("session_recording");
    // The /privacy opt-out button pokes window.posthog so it applies without a reload.
    expect((window as { posthog?: unknown }).posthog).toBe(posthog);
  });

  it("falls back to the direct PostHog host when the proxy var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    render(<AnalyticsProvider />);
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ api_host: "https://us.i.posthog.com" });
  });

  it("touches no consent storage when the SDK has no stale opt-out record", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    render(<AnalyticsProvider />);
    expect(posthog.clear_opt_in_out_capturing).not.toHaveBeenCalled();
  });

  it("clears PostHog's own opt-out record left behind by an opt-out → reload → opt-in round trip", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    posthog.has_opted_out_capturing.mockReturnValue(true);
    render(<AnalyticsProvider />);
    // Cleared, not opted in: opting in would write a `__ph_*` key back to the device.
    expect(posthog.clear_opt_in_out_capturing).toHaveBeenCalledOnce();
  });

  it("does not re-init an already-loaded SDK (strict mode double-effect, fast refresh)", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    posthog.__loaded = true;
    render(<AnalyticsProvider />);
    expect(posthog.init).not.toHaveBeenCalled();
  });
});

describe("AnalyticsProvider identity (ticket 05)", () => {
  const signedIn = (github_id?: number) =>
    localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "no", github_id }));

  it("a plain visitor gets no bootstrap and stays on memory-only persistence", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    render(<AnalyticsProvider />);

    expect(initOptions()).not.toHaveProperty("bootstrap");
    expect(initOptions()).toMatchObject({ persistence: "memory" });
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("restores the anonymous id parked before the OAuth trip, so the merge has something to merge", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    sessionStorage.setItem(ANON_ID_KEY, "anon-abc");
    render(<AnalyticsProvider />);

    // isIdentifiedID stays off: posthog-js only emits $identify with
    // $anon_distinct_id when the bootstrapped id is marked anonymous.
    expect(initOptions().bootstrap).toEqual({ distinctID: "anon-abc" });
    expect(initOptions()).toMatchObject({ persistence: "memory" });
    // Consumed — a later load in this tab must not re-merge a stale id.
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBeNull();
  });

  it("boots a signed-in visitor straight into their identified id, with no per-load merge", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    signedIn(4242);
    render(<AnalyticsProvider />);

    // Initialising anonymously and identifying a beat later would mint a throwaway
    // anonymous id on EVERY page load and merge it in, growing the person's alias
    // list forever. Bootstrapping as identified skips that entirely.
    expect(initOptions().bootstrap).toEqual({ distinctID: "4242", isIdentifiedID: true });
    expect(initOptions()).toMatchObject({ persistence: "localStorage+cookie" });
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("never bootstraps a stale anonymous id over a signed-in person", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    signedIn(4242);
    sessionStorage.setItem(ANON_ID_KEY, "anon-abc");
    render(<AnalyticsProvider />);

    // posthog-js resets USER_STATE to anonymous for a non-identified bootstrap, so
    // this would silently un-identify a signed-in person on every reload.
    expect(initOptions().bootstrap).toEqual({ distinctID: "4242", isIdentifiedID: true });
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBeNull(); // still consumed, not left to rot
  });

  it.each([0, -1, 1.5, "4242", null])("refuses to key a person on a junk github_id (%p)", (bad) => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    // The writer rejects these, so they can only arrive from hand-edited or
    // corrupted storage — but one shared rule means the reader rejects them too,
    // rather than bootstrapping distinctID "0".
    localStorage.setItem(SESSION_KEY, JSON.stringify({ login: "octocat", consent: "no", github_id: bad }));
    render(<AnalyticsProvider />);

    expect(initOptions()).not.toHaveProperty("bootstrap");
    expect(initOptions()).toMatchObject({ persistence: "memory" });
  });

  it("treats a pre-ticket-05 session with no github_id as an ordinary anonymous visitor", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
    signedIn(undefined);
    render(<AnalyticsProvider />);

    expect(initOptions()).not.toHaveProperty("bootstrap");
    expect(initOptions()).toMatchObject({ persistence: "memory" });
  });
});
