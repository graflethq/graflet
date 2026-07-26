import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ANALYTICS_OPT_OUT_KEY } from "@/lib/analytics";

// The real SDK would open a websocket-ish request queue on init; the whole point
// of these tests is *whether* init happens, so a stub is enough.
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    __loaded: false,
    has_opted_out_capturing: vi.fn(() => false),
    clear_opt_in_out_capturing: vi.fn(),
  },
}));
const posthog = (await import("posthog-js")).default as unknown as {
  init: ReturnType<typeof vi.fn>;
  __loaded: boolean;
  has_opted_out_capturing: ReturnType<typeof vi.fn>;
  clear_opt_in_out_capturing: ReturnType<typeof vi.fn>;
};

const KEY = "phc_test_token";

beforeEach(() => {
  posthog.init.mockClear();
  posthog.clear_opt_in_out_capturing.mockClear();
  posthog.has_opted_out_capturing.mockReturnValue(false);
  posthog.__loaded = false;
  localStorage.clear();
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
