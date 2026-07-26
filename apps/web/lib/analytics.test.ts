import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ANALYTICS_OPT_OUT_KEY, capture, isAnalyticsOptedOut, searchTerm, setAnalyticsOptOut } from "./analytics";

// The SDK singleton, stubbed: these tests are about what we hand it and when.
vi.mock("posthog-js", () => ({ default: { __loaded: false, capture: vi.fn() } }));
const ph = (await import("posthog-js")).default as unknown as {
  __loaded: boolean;
  capture: ReturnType<typeof vi.fn>;
};

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

describe("capture (ticket 04: one door for every explicit event)", () => {
  beforeEach(() => {
    ph.capture.mockClear();
    ph.__loaded = false;
  });

  it("stays silent when the SDK never initialised — no token, or this device opted out", () => {
    capture("catalog_search", { query: "react", result_count: 1 });
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("forwards name and properties untouched once the SDK is up", () => {
    ph.__loaded = true;
    capture("catalog_search", { query: "react", result_count: 1 });
    expect(ph.capture).toHaveBeenCalledWith("catalog_search", { query: "react", result_count: 1 });
  });
});

describe("searchTerm (ticket 04: a search box is free text)", () => {
  it("case-folds so React and react are one demand signal", () => {
    expect(searchTerm("React")).toBe("react");
  });

  it("clips to 64 characters, so a pasted paragraph or secret can't ride along", () => {
    const term = searchTerm("x".repeat(200));
    expect(term).toHaveLength(64);
    expect(term).toBe("x".repeat(64));
  });

  it("reads whitespace-only as nothing worth sending", () => {
    expect(searchTerm("   ")).toBe("");
    expect(searchTerm("")).toBe("");
    expect(searchTerm("  react  ")).toBe("react");
  });
});
