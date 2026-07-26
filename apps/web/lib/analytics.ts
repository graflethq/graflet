/**
 * The analytics opt-out switch (ADR-0010, ticket 02).
 *
 * The privacy page has to name a way out that actually works, not just describe
 * one. This is it: a single boolean on the visitor's device, read by the PostHog
 * provider before it initialises (ticket 03) and honoured immediately by poking
 * the live SDK if one is already on the page.
 *
 * It is deliberately NOT a `ph_*` key: an anonymous visitor still gets nothing
 * written to their device, and this entry appears only when someone explicitly
 * opts out — the one preference we have to remember to keep that promise. The
 * `graflet:` prefix follows `SESSION_KEY` in `lib/session.ts`; both are listed by
 * name on /privacy, so one naming convention, not two.
 */
export const ANALYTICS_OPT_OUT_KEY = "graflet:analytics-opt-out";

/** True when this browser has opted out. Storage blocked (Safari private mode, ITP) reads as "not opted out". */
export function isAnalyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Records the choice and applies it to any already-running SDK, so it takes effect without a reload. */
export function setAnalyticsOptOut(optOut: boolean): void {
  try {
    if (optOut) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    // Storage blocked: the choice can't survive a reload, but the SDK call below
    // still stops capture for this page view. Better than throwing at the user.
  }
  const ph = (globalThis as { posthog?: Partial<Record<"opt_out_capturing" | "opt_in_capturing", () => void>> })
    .posthog;
  if (optOut) ph?.opt_out_capturing?.();
  else ph?.opt_in_capturing?.();
}
