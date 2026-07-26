import posthog from "posthog-js";

/**
 * The analytics seam (ADR-0010): the opt-out switch (ticket 02) and the one
 * function every explicit event goes through (ticket 04).
 *
 * The privacy page has to name a way out that actually works, not just describe
 * one. That is the opt-out below: a single boolean on the visitor's device, read by
 * the PostHog provider before it initialises (ticket 03) and honoured immediately by
 * poking the live SDK if one is already on the page.
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

/**
 * Every explicit event the site sends, spelled once (`.scratch/posthog/spec.md`).
 * A union rather than `string` because captured events cannot be renamed
 * retroactively: a typo would be a permanently split series that no amount of
 * dashboard work can rejoin, so it has to fail at compile time, not in production.
 */
type SiteEvent = "catalog_search" | "command_copied" | "doc_row_click" | "signin_started" | "support_click";

/**
 * Fire one named product event (ticket 04). Silent unless the SDK actually
 * initialised — no project token in local dev, or this device opted out, in which
 * case `AnalyticsProvider` never called `init` — because posthog-js logs an error
 * for every capture made before init.
 */
export function capture(event: SiteEvent, props?: Record<string, unknown>): void {
  if (posthog.__loaded) posthog.capture(event, props);
}

/**
 * A search box is free text — someone can paste an API key, an email or a paragraph
 * into it. Case-fold so `React` and `react` are one demand signal, and clip to 64
 * characters so what leaves the browser stays a search term rather than an accidental
 * payload. Whitespace-only gives "", which callers read as "nothing worth sending".
 */
export function searchTerm(query: string): string {
  return query.trim().toLowerCase().slice(0, 64);
}
