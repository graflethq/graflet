/**
 * Server-side capture (ticket 06 / ADR-0010).
 *
 * The events that decide what to build next happen where the browser cannot see
 * them. A KG download is brokered here (ADR-0002) and most downloads come from the
 * CLI with no browser present at all, so `posthog-js` structurally cannot observe
 * the gate — and even on the site an ad blocker can hide it. A server call has no
 * blocker to defeat and already knows the `github_id`, so it needs no reverse proxy
 * (ADR-0010 puts that on the browser leg only) and lands on the same person as the
 * site's events.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **Capture never changes a response.** Every call is fire-and-forget through
 *    `ctx.waitUntil`, and every failure is swallowed. If PostHog is down, slow, rate
 *    limiting us, or the key is missing entirely, each endpoint returns exactly what
 *    it returned before.
 * 2. **Nothing is lost to Worker teardown.** `flushAt: 1` + `flushInterval: 0`
 *    defeat batching, because a Worker can terminate before a batch flushes.
 */

import { PostHog } from "posthog-node";

/** Direct, not through the browser's reverse proxy — there is no blocker to defeat
 *  server-side, and the proxy would only add a hop (ADR-0010). */
const POSTHOG_HOST = "https://us.i.posthog.com";

// Outbound-fetch seam, same pattern as github.ts / notify.ts: tests swap this so
// the suite asserts on the real payload without touching the network.
let analyticsFetch: typeof fetch = (input, init) => fetch(input, init);

/** Test-only: replace the fetch used for PostHog calls. */
export function __setAnalyticsFetchForTests(f: typeof fetch): void {
  analyticsFetch = f;
}

/**
 * Every event the Worker sends, spelled once (`.scratch/posthog/spec.md`). A union
 * rather than `string` for the same reason as the site's: a captured event cannot be
 * renamed retroactively, so a typo would be a permanently split series that no
 * dashboard work can rejoin. It has to fail at compile time.
 *
 * `watch_removed` is in the spec but absent here — there is no unwatch endpoint to
 * fire it from. Adding the name without a trigger would put a permanently empty
 * series on the dashboard.
 */
export type WorkerEvent = "signin_completed" | "kg_download_brokered" | "download_failed" | "watch_created";

export interface Tracker {
  /** Record one product event against a person. `distinctId` is always the
   *  `github_id` as a string — the join key the site and CLI also use. */
  capture(event: WorkerEvent, distinctId: string, properties?: Record<string, unknown>): void;
  /** Record a thrown error. Workers observability only shows a failure if you go
   *  looking, and nobody looks until a user complains. No `distinctId`: the paths
   *  that throw are the ones that failed before, or while, working out who is
   *  calling. Add one the day a catch block has a person in hand. */
  error(err: unknown): void;
}

/** A tracker that does nothing, for when no key is configured. */
const SILENT: Tracker = { capture: () => {}, error: () => {} };

/**
 * One tracker per request (PostHog's Cloudflare guidance: an isolate is reused
 * across requests, and `shutdown()` is one-shot per client instance).
 *
 * ponytail: a fresh client per *event*, not per request. Every handler fires at most
 * one event, so in practice that is the same thing, and it keeps the lifecycle
 * impossible to get wrong — no shared client to forget to flush. If a handler ever
 * needs to fire several, hoist the client to the closure and flush once.
 */
export function createTracker(env: Env, ctx: ExecutionContext): Tracker {
  const key = env.POSTHOG_PROJECT_KEY;
  // No key: local dev, or the secret was never set. Silent rather than throwing —
  // analytics is never the reason an endpoint breaks.
  if (!key) return SILENT;

  const send = (use: (client: PostHog) => Promise<void>): void => {
    // `waitUntil`, not `await`: this keeps the Worker alive until the event is
    // flushed WITHOUT making the caller wait for a round trip to PostHog before
    // their download starts.
    ctx.waitUntil(
      (async () => {
        const client = new PostHog(key, {
          host: POSTHOG_HOST,
          // A Worker can terminate before a batch flushes, so don't batch.
          flushAt: 1,
          flushInterval: 0,
          // No personalApiKey is passed, so no feature-flag poller is constructed
          // and the client schedules no timers at all — nothing to keep alive.
          fetch: (url, init) => analyticsFetch(url, init as RequestInit),
        });
        try {
          await use(client);
        } catch {
          // Swallowed on purpose: rule 1 above. A capture failure is invisible to
          // the caller, by design.
        } finally {
          await client.shutdown().catch(() => {});
        }
      })(),
    );
  };

  return {
    capture: (event, distinctId, properties) => send((c) => c.captureImmediate({ distinctId, event, properties })),
    error: (err) => send((c) => c.captureExceptionImmediate(err instanceof Error ? err : new Error(String(err)))),
  };
}
