import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ANALYTICS_OPT_OUT_KEY,
  ANON_ID_KEY,
  capture,
  forgetPerson,
  identifyPerson,
  isAnalyticsOptedOut,
  rememberAnonId,
  searchTerm,
  setAnalyticsOptOut,
  takeAnonId,
} from "./analytics";

// The SDK singleton, stubbed: these tests are about what we hand it and when.
vi.mock("posthog-js", () => ({
  default: {
    __loaded: false,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    set_config: vi.fn(),
    get_distinct_id: vi.fn(() => "anon-abc"),
  },
}));
const ph = (await import("posthog-js")).default as unknown as {
  __loaded: boolean;
  capture: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  set_config: ReturnType<typeof vi.fn>;
  get_distinct_id: ReturnType<typeof vi.fn>;
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

describe("identity (ticket 05: sign-in is the consent boundary)", () => {
  beforeEach(() => {
    ph.identify.mockClear();
    ph.reset.mockClear();
    ph.set_config.mockClear();
    ph.get_distinct_id.mockClear().mockReturnValue("anon-abc");
    ph.__loaded = true;
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    ph.__loaded = false;
  });

  it("keys the person on the numeric id, not the handle a user can rename", () => {
    identifyPerson(4242, "octocat");
    expect(ph.identify).toHaveBeenCalledWith("4242", { github_login: "octocat" });
  });

  it("switches persistence on before identifying, so the identity is the first thing stored", () => {
    identifyPerson(4242, "octocat");
    expect(ph.set_config).toHaveBeenCalledWith({ persistence: "localStorage+cookie" });
    expect(ph.set_config.mock.invocationCallOrder[0]).toBeLessThan(ph.identify.mock.invocationCallOrder[0]);
  });

  it("sends no email and nothing else beyond the login — the Worker sets the rest (ticket 06)", () => {
    identifyPerson(4242, "octocat");
    expect(Object.keys(ph.identify.mock.calls[0][1])).toEqual(["github_login"]);
  });

  it("does nothing at all when the SDK never initialised (no token, or opted out)", () => {
    ph.__loaded = false;
    identifyPerson(4242, "octocat");
    forgetPerson();
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.set_config).not.toHaveBeenCalled();
    expect(ph.reset).not.toHaveBeenCalled();
  });

  it("sign-out drops the identity AND stops writing to the device, so the next visitor is anonymous again", () => {
    forgetPerson();
    expect(ph.reset).toHaveBeenCalledOnce();
    expect(ph.set_config).toHaveBeenCalledWith({ persistence: "memory" });
    // reset() clears what is stored; only then is it safe to stop writing. The other
    // order would leave the previous person's id sitting on the device.
    expect(ph.reset.mock.invocationCallOrder[0]).toBeLessThan(ph.set_config.mock.invocationCallOrder[0]);
  });
});

describe("anonymous id hand-off (ticket 05: sign-in leaves the site and comes back)", () => {
  beforeEach(() => {
    ph.get_distinct_id.mockClear().mockReturnValue("anon-abc");
    ph.__loaded = true;
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    ph.__loaded = false;
  });

  it("carries the anonymous id across the OAuth round trip, and hands it over exactly once", () => {
    rememberAnonId();
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBe("anon-abc");

    expect(takeAnonId()).toBe("anon-abc");
    // Read-and-remove: a second page load in the same tab must not re-merge a
    // stale id onto whoever is browsing then.
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBeNull();
    expect(takeAnonId()).toBeNull();
  });

  it("writes nothing when the SDK never initialised — a visitor who opted out stays untouched", () => {
    ph.__loaded = false;
    rememberAnonId();
    expect(sessionStorage.getItem(ANON_ID_KEY)).toBeNull();
  });

  it("never throws when storage is blocked — private mode still gets to sign in", () => {
    const denied = () => {
      throw new Error("storage denied");
    };
    vi.stubGlobal("sessionStorage", { getItem: denied, setItem: denied, removeItem: denied });
    expect(() => rememberAnonId()).not.toThrow();
    expect(takeAnonId()).toBeNull();
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
