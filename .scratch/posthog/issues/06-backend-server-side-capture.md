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

**Status:** needs-triage

- [ ] `posthog-node` is initialised per request from a Worker secret (never a committed token), with `flushAt: 1`
      and `flushInterval: 0`, and the client is shut down / flushed before the response resolves so no event is lost
      to Worker teardown.
- [ ] `signin_completed` fires from `apps/backend/src/auth.ts` with `is_new_user` — pairs with `signin_started`
      (ticket 04) to give the real sign-in conversion rate.
- [ ] `kg_download_brokered` fires from `apps/backend/src/broker.ts` with `doc`, `version`, `sha`, `bytes`. This is
      the single authoritative download event; the CLI's own event (ticket 07) means "bytes landed on disk", which
      is a different fact and both are worth having.
- [ ] `download_failed` fires with a `reason` on the failure paths in `broker.ts`.
- [ ] `watch_created` / `watch_removed` fire from `apps/backend/src/watch.ts` with `doc`.
- [ ] `distinct_id` is the same `github_id` string the site uses (ticket 05) — verified by finding one person with
      both a site event and a backend event on their timeline.
- [ ] `captureException` is called in the Worker's catch blocks, and a deliberately induced failure shows up in
      PostHog error tracking.
- [ ] **No** per-request `catalog_served` event is added (spec: request logging, not a product event — and it would
      dominate the 1M/month allowance on its own).
- [ ] Capture never changes a response: if PostHog is down, slow, or the token is missing, the endpoint still
      returns what it returned before. Proved by a test with capture forced to throw.
- [ ] Backend vitest passes. Per the repo's known issue, run it via a clean shell env (`ZDOTDIR=/nonexistent`,
      `ENV`/`BASH_ENV` unset) or the nvm `FUNCNEST` recursion kills the full run.
