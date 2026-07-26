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
 * The anonymous distinct id, parked for the duration of the OAuth round trip.
 *
 * Sign-in is a full document navigation — off to github.com and back — and ticket
 * 03 ships `persistence: 'memory'`, so the anonymous id dies on the way out. Without
 * this, everything a person did before signing in would strand on a timeline nobody
 * can ever reach again, and the visit → sign-in → download funnel would begin on one
 * person and end on another.
 *
 * `sessionStorage`, not `localStorage`: this belongs to one tab and one trip, and it
 * is gone when the tab closes. Written only when someone clicks "Sign in with
 * GitHub" — a visitor who merely browses still leaves this device untouched, which
 * is ticket 03's promise and what /privacy says. Named `graflet:` like the other two
 * keys, so the page can list all three under one convention.
 */
export const ANON_ID_KEY = "graflet:analytics-anon-id";

/** Park the anonymous id for the trip to GitHub. No-op unless the SDK is running. */
export function rememberAnonId(): void {
  if (!posthog.__loaded) return;
  try {
    const id = posthog.get_distinct_id();
    if (id) sessionStorage.setItem(ANON_ID_KEY, id);
  } catch {
    // Storage blocked (private mode): no merge on return, but the sign-in itself
    // must never fail over analytics bookkeeping.
  }
}

/** The parked id, removed as it is read — one round trip, one use. */
export function takeAnonId(): string | null {
  try {
    const id = sessionStorage.getItem(ANON_ID_KEY);
    if (id) sessionStorage.removeItem(ANON_ID_KEY);
    return id;
  } catch {
    return null;
  }
}

/**
 * Turn the anonymous visitor into an identified person (ticket 05 / ADR-0010).
 * Sign-in is the consent boundary the ADR chose: an explicit act carrying its own
 * disclosure, which is why nothing identifies anyone before this point.
 *
 * `distinct_id` is the numeric `github_id` as a string, never the login — a handle
 * can be renamed, and a renamed handle would silently fork one person into two with
 * no way to rejoin them. It is the same value the Worker (ticket 06) and the CLI
 * (ticket 07) use, which is the only reason those three land on one timeline.
 *
 * `email` is deliberately absent: the Worker attaches it server-side (ticket 06) so
 * it never has to ride through the browser. /privacy names all three fields.
 */
export function identifyPerson(githubId: number, login: string): void {
  if (!posthog.__loaded) return;
  // `set_config`, not a re-init: a re-init would drop the queued events and the
  // in-flight session. Persistence flips first so the identity is the first thing
  // written, rather than landing in memory and being lost on the next navigation.
  posthog.set_config({ persistence: "localStorage+cookie" });
  posthog.identify(String(githubId), { github_login: login });
}

/**
 * Sign out of analytics (ticket 05): a shared machine must not file the next
 * person's events under the last one.
 *
 * Both calls are needed, and not for the obvious reason. `reset()` clears the store
 * but then immediately registers a *fresh* anonymous id into it
 * (`posthog-core.ts:3011-3050`), so on its own it would leave a signed-out browser
 * holding a new `ph_*` entry — the very thing /privacy says does not exist before
 * sign-in. Switching persistence to `memory` is what removes them: changing the
 * backend makes posthog-js clear the old layout and re-save into the new one
 * (`posthog-persistence.ts:798-812`). `reset()` is still first, so the departing
 * person's identity is gone before anything is rebuilt.
 */
export function forgetPerson(): void {
  if (!posthog.__loaded) return;
  posthog.reset();
  posthog.set_config({ persistence: "memory" });
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
