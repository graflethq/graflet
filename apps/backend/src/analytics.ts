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

/** A DIFFERENT host from the one above, and PostHog is strict about it: capture is a
 *  public write-only endpoint on `us.i.posthog.com`, while everything authenticated
 *  by a personal API key — person deletion included — lives on `us.posthog.com`. */
const POSTHOG_API_HOST = "https://us.posthog.com";

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

/** The one field of PostHog's bulk-delete reply this module reads (their OpenAPI
 *  schema's `PersonBulkDeleteResponse`; the counts beside it have no caller). */
interface BulkDeleteResult {
  deletion_errors?: unknown[];
}

/**
 * Erase the PostHog person behind `distinctId` — the second half of the two-system
 * erasure ADR-0010 signed us up for (ticket 09).
 *
 * The exact opposite contract to `createTracker` above, in every respect, and
 * deliberately so: this is awaited rather than fired into `waitUntil`, and every
 * failure THROWS rather than being swallowed. A silently-failed delete leaves a
 * person profile in a US third-party store keyed to an account that no longer
 * exists — precisely the state the obligation forbids — so the caller has to be
 * able to see the failure and decline to delete our own rows on top of it.
 *
 * `bulk_delete` with a single distinct id, not `DELETE /persons/:id/`: that one wants
 * the person's UUID, which we do not have and would need a lookup call to learn,
 * making it two round trips and a race. Passing the distinct id also makes this
 * naturally idempotent — an id matching nobody comes back `persons_found: 0` and a
 * 202, not an error, which is what lets a retry finish a half-done deletion.
 *
 * `posthog-node` is not involved: it is a capture client and has no delete surface.
 * The shared `analyticsFetch` seam is, so tests assert on the real outbound request.
 */
export async function deletePerson(env: Env, distinctId: string): Promise<void> {
  const key = env.POSTHOG_PERSONAL_API_KEY;
  // Unlike capture, a missing key is NOT a silent no-op here. Returning success
  // without a key would report a two-system erasure that only ever happened in one
  // system — the failure mode this whole function exists to prevent.
  if (!key || !env.POSTHOG_PROJECT_ID) throw new Error("posthog person deletion is not configured");

  const res = await analyticsFetch(`${POSTHOG_API_HOST}/api/projects/${env.POSTHOG_PROJECT_ID}/persons/bulk_delete/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Erasure means the events and the replays too, not just the profile they hang
    // off. PostHog queues both asynchronously (their docs: event deletion runs out of
    // peak hours), so the 202 is an acknowledgement that it is queued, not that the
    // rows are already gone. The person record itself goes immediately.
    body: JSON.stringify({ distinct_ids: [distinctId], delete_events: true, delete_recordings: true }),
  });
  if (!res.ok) throw new Error(`posthog person delete failed: ${res.status}`);

  const body = (await res.json().catch(() => ({}))) as BulkDeleteResult;
  // PostHog reports per-person failures in the body of an otherwise-2xx response.
  // Reading only the status code would turn exactly those into a false success.
  if (body.deletion_errors?.length) {
    throw new Error(`posthog person delete reported ${body.deletion_errors.length} error(s)`);
  }
}
