# 06 — Backend Worker server-side capture + `captureException`

**What to build:** The backend Worker captures the events that actually matter, from the one place that always sees
them. A KG download is brokered server-side (ADR-0002) and most downloads come from the CLI with no browser
present, so the browser SDK structurally cannot observe the gate — and even on the site, an ad blocker can hide it.
Server-side capture has no blocker to defeat and already knows the `github_id`, so it needs no proxy and stitches
onto the same person as the site events. `posthog-node` is configured with `flushAt: 1, flushInterval: 0` because
PostHog's Cloudflare Workers doc is explicit that a Worker can terminate before a batch flushes, losing the event.
Exceptions are captured too — Workers observability only shows a failure if you go looking, and nobody looks until
a user complains.

**Blocked by:** 01 (token), 02 (privacy page).

**Status:** ✅ **done 2026-07-26**

- [x] `posthog-node` is initialised per request from a Worker secret (never a committed token), with `flushAt: 1`
      and `flushInterval: 0`, and the client is shut down / flushed before the response resolves so no event is lost
      to Worker teardown.
      `apps/backend/src/analytics.ts`, secret `POSTHOG_PROJECT_KEY`. **Deviation: `ctx.waitUntil(...)`, not `await`
      before the response.** That is PostHog's own Workers guidance and is strictly better here — it still keeps the
      Worker alive until the event flushes, without making someone's download wait on a round trip to PostHog. The
      box's intent ("no event lost to teardown") holds; the mechanism differs.
      `posthog-node@5.46.1` ships a `workerd` export with no `node:` builtins, so **no `nodejs_compat` flag was
      needed**. No `personalApiKey` is passed, so no feature-flag poller is constructed and the client schedules no
      timers at all (`flushInterval: 0` is falsy, so the lazy flush timer is never created either).
- [x] `signin_completed` fires from `apps/backend/src/auth.ts` with `is_new_user` — pairs with `signin_started`
      (ticket 04) to give the real sign-in conversion rate.
      Fires from **both** callbacks (website and CLI), with a `surface` property to tell them apart. `is_new_user`
      comes from `INSERT … ON CONFLICT DO UPDATE … RETURNING created_at`: `DO UPDATE` never touches `created_at`, so
      a returned value equal to the one just passed means a fresh insert — exact, one query, no read-then-write race.
      It also carries `$set: { github_login, email }`, which is how ticket 05's third field reaches PostHog without
      passing through the browser.
- [x] `kg_download_brokered` fires from `apps/backend/src/broker.ts` with `doc`, `version`, `sha`, `bytes`.
      `bytes` is GitHub's `Content-Length` where it sends one, else `null`. The body is streamed straight through
      (ADR-0002) and buffering it just to count bytes would defeat that.
- [x] `download_failed` fires with a `reason` on the failure paths in `broker.ts`.
      Two reasons: `no_deliverable_kg` and `bundle_unavailable`. **The 401 path deliberately fires nothing** — an
      unauthenticated caller has no `github_id`, so the event could never join to a person, and every unauthenticated
      probe of this public URL would land in the count as a "failed download".
- [x] `watch_created` / `watch_removed` fire from `apps/backend/src/watch.ts` with `doc`.
      `watch_created` only, and only on an actual insert (`res.meta.changes > 0`) — the endpoint is idempotent, so a
      CLI that re-watches every run would otherwise report a call count dressed as a watch count.
      **`watch_removed` was not built: there is no unwatch endpoint to fire it from.** Same call as ticket 04 made
      for `doc_row_click` — a named event with no trigger is a permanently empty series on the dashboard. It is
      removed from the `WorkerEvent` union, so adding the endpoint will fail to compile until the event is added back.
- [x] `distinct_id` is the same `github_id` string the site uses (ticket 05) — verified by finding one person with
      both a site event and a backend event on their timeline.
      **Verified live on production, 2026-07-26.** Person `2580a34b-c055-5740-a827-f166fdc172ab` carries the
      browser's `$pageview` / `signin_started` and this Worker's `signin_completed` (`distinct_id: "35300157"`,
      `surface: website`, `is_new_user: false`) on one timeline. `$set` landed too: the person's `email` came from
      the Worker, never through the browser, which is the whole reason ticket 05 stopped sending it. Full evidence
      table on ticket 05.
- [x] `captureException` is called in the Worker's catch blocks, and a deliberately induced failure shows up in
      PostHog error tracking.
      One top-level `try/catch` in `src/index.ts` wrapping the whole router — the single place that sees every
      unhandled failure — plus the two OAuth callback catches, which swallow their errors by design and would
      otherwise report nothing. Tested by inducing a throw and asserting a `$exception` event on the wire.
- [x] **No** per-request `catalog_served` event is added.
      Asserted: a `GET /catalog` produces zero captures.
- [x] Capture never changes a response: if PostHog is down, slow, or the token is missing, the endpoint still
      returns what it returned before. Proved by a test with capture forced to throw.
      Three layers: no key → a no-op tracker; every call is fire-and-forget inside `waitUntil`; every failure is
      swallowed. The test forces the analytics fetch to throw and asserts the download still returns 200, the right
      `X-KG-Sha`, and the right bytes.
- [x] Backend vitest passes. Per the repo's known issue, run it via a clean shell env.
      76 tests, 8 files, green:
      `env -u ENV -u BASH_ENV _ZO_DOCTOR=0 ZDOTDIR=/nonexistent node node_modules/vitest/vitest.mjs run`

## Worth knowing for the next ticket

- **`posthog-node` gzips its batch payload.** Any test that inspects the wire body must gunzip it
  (`DecompressionStream("gzip")`) — a plain `JSON.parse` silently sees nothing, which reads exactly like "capture
  never fired". `src/analytics.test.ts` has the helper.
- The `fetch` option's body is a `Blob`, not a string.
- Ticket 07 (CLI) uses the same `posthog-node` and the same `github_id` `distinct_id`; the `WorkerEvent` union in
  `src/analytics.ts` is the pattern to copy for `cli_*` events.

## Operator step before this does anything in production

```sh
cd apps/backend && pnpm exec wrangler secret put POSTHOG_PROJECT_KEY
```

Until that is set, the Worker captures nothing — deliberately, so no deploy can half-work.
