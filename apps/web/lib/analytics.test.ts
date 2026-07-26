import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ANALYTICS_OPT_OUT_KEY, isAnalyticsOptedOut, setAnalyticsOptOut } from "./analytics";

describe("analytics opt-out (ADR-0010: the privacy page must name a switch that works)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is off by default and survives as a single device-local key once set", () => {
    expect(isAnalyticsOptedOut()).toBe(false);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();

    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe("1");

    // Opting back in leaves nothing behind — the page promises the entry exists
    // only while you have asked for it.
    setAnalyticsOptOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it("applies the choice to a live SDK, so it takes effect without a reload", () => {
    const opt_out_capturing = vi.fn();
    const opt_in_capturing = vi.fn();
    vi.stubGlobal("posthog", { opt_out_capturing, opt_in_capturing });

    setAnalyticsOptOut(true);
    expect(opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(opt_in_capturing).not.toHaveBeenCalled();

    setAnalyticsOptOut(false);
    expect(opt_in_capturing).toHaveBeenCalledTimes(1);
  });

  it("never throws when storage is blocked — a private-mode visitor still gets a working button", () => {
    const denied = () => {
      throw new Error("storage denied");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    const opt_out_capturing = vi.fn();
    vi.stubGlobal("posthog", { opt_out_capturing });

    expect(isAnalyticsOptedOut()).toBe(false);
    expect(() => setAnalyticsOptOut(true)).not.toThrow();
    // The choice can't persist, but this page view still stops being measured.
    expect(opt_out_capturing).toHaveBeenCalledTimes(1);
  });
});
