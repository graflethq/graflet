# 03 — Site SDK wiring: anonymous by default, proxy host, replay + error tracking

**What to build:** `posthog-js` runs on `graflet.rnui.dev`, talking to the managed proxy hostname rather than
`us.i.posthog.com`, so ad blockers see a first-party request. It captures **anonymously by default** — memory-only
persistence and `person_profiles: 'identified_only'`, meaning a visitor who never signs in is counted but has
nothing written to their device and creates no person row. Autocapture, rage clicks, heatmaps, session replay and
exception capture are all on; replay keeps its **default input masking**, because search terms come from the
explicit event in ticket 04, not from the video. Pageviews must fire on client-side route changes too — a Next App
Router navigation is not a document load, so the default single `$pageview` would under-count every page but the
first.

**Blocked by:** 01 (token + proxy host), 02 (privacy page must be true before this deploys).

**Status:** needs-triage

- [ ] `posthog-js` is initialised once, client-side, from a provider mounted in `apps/web/app/layout.tsx`, and the
      app still renders with the env vars absent (local dev without a token must not crash or spam errors).
- [ ] `api_host` is the **proxy hostname** from ticket 01 and `ui_host` is `https://us.posthog.com`, so in-app links
      point at PostHog rather than at our proxy.
- [ ] Before sign-in: `persistence: 'memory'` and `person_profiles: 'identified_only'`. Verified in a browser —
      **no `ph_*` cookie and no `ph_*` localStorage key** exists for an anonymous visitor.
- [ ] `autocapture`, rage clicks, heatmaps, session recording and `capture_exceptions` are enabled, and replay's
      default input masking is left **on** (no `maskAllInputs: false`, no per-field unmasking).
- [ ] `$pageview` fires on client-side navigation, not just first load — proved by navigating `/` → `/support` →
      `/privacy` and seeing three pageviews.
- [ ] A real event arrives in the `graflet` project through the proxy host, confirmed by the network tab showing the
      request going to the first-party subdomain, not to `i.posthog.com`.
- [ ] With uBlock Origin (or equivalent) enabled, events still arrive — the whole point of ticket 01. If they do
      not, the chosen subdomain or path is already on a blocklist and needs changing; record the finding here.
- [ ] The provider calls `isAnalyticsOptedOut()` (`apps/web/lib/analytics.ts`, added by ticket 02) **before**
      `posthog.init` and skips init entirely when it returns true. The `/privacy` opt-out button is already live and
      already writes the key — until this box is ticked, the page names a switch the SDK ignores.
- [ ] `next.config.ts` gains **no** PostHog `rewrites` — proxying deliberately does not run through our Worker
      (ADR-0010). No `skipTrailingSlashRedirect` is needed either, since that only applies to the rewrites path.
- [ ] Existing `apps/web` tests pass, and the provider is inert under vitest/jsdom (no network calls in tests).
