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

**Status:** done 2026-07-26 — with one box deliberately left open (the uBlock check needs a browser that has a
content blocker; this one has none). Built and verified against a local production build; **not yet deployed** — the
branch still has to ship before any of it captures real traffic.

- [x] `posthog-js` is initialised once, client-side, from a provider mounted in `apps/web/app/layout.tsx`, and the
      app still renders with the env vars absent (local dev without a token must not crash or spam errors).
      `apps/web/components/analytics-provider.tsx` (`<AnalyticsProvider />`, mounted in `app/layout.tsx`). It
      renders `null` rather than wrapping children: there is no React context to hand down, and event call sites in
      tickets 04/05 import the same `posthog` singleton. Init is guarded by `posthog.__loaded`, because a second
      `init` logs *"You have already initialized PostHog"* on every fast refresh.
- [x] `api_host` is the **proxy hostname** from ticket 01 and `ui_host` is `https://us.posthog.com`, so in-app links
      point at PostHog rather than at our proxy. Read back off the live SDK:
      `api_host: "https://edge.graflet.rnui.dev"`, `ui_host: "https://us.posthog.com"`. Unsetting
      `NEXT_PUBLIC_POSTHOG_HOST` falls back to `https://us.i.posthog.com` — the documented escape hatch if the
      proxy ever 522s.
- [x] Before sign-in: `persistence: 'memory'` and `person_profiles: 'identified_only'`. Verified in a browser —
      **no `ph_*` cookie and no `ph_*` localStorage key** exists for an anonymous visitor. Both read back off the
      live config; zero cookies and zero localStorage keys carrying this project's token. **And a real bug caught
      here — see the comment below on `defaults`: the dated defaults bundle was creating a person row per page
      load.** After removing it: `SELECT count() FROM persons WHERE created_at >= now() - INTERVAL 5 MINUTE` → `0`
      across a fresh anonymous visit.
- [x] `autocapture`, rage clicks, heatmaps, session recording and `capture_exceptions` are enabled, and replay's
      default input masking is left **on** (no `maskAllInputs: false`, no per-field unmasking). All of
      `autocapture`, `rageclick`, `enable_heatmaps`, `disable_session_recording`, `capture_exceptions` and
      `capture_pageleave` are stated explicitly in `posthog.init` rather than inherited from project settings or
      from this SDK version's defaults, so the capture surface is readable in the code — and cannot drift on an
      upgrade, which is exactly how the `defaults` bug below got in.
      Confirmed live by the extension bundles fetched through the proxy — `posthog-recorder.js`,
      `exception-autocapture.js`, `dead-clicks-autocapture.js`, `surveys.js` — plus `$autocapture` events and `/s/`
      replay posts in the project. No `session_recording` key is passed at all, so masking is untouched.
- [x] `$pageview` fires on client-side navigation, not just first load — proved by navigating `/` → `/support` →
      `/privacy` and seeing three pageviews. Three `$pageview` rows for those three URLs are in the project.
      **But the SPA half of this box needed a different proof, and turned up a finding: this site has no
      client-side navigation at all.** `grep -rn "next/link" apps/web` → nothing; every internal link is a plain
      `<a>`, so each one is a full document load and would be counted anyway. `capture_pageview: 'history_change'`
      is set regardless (it is correct the day a `<Link>` lands) and was proved live with
      `history.pushState({}, '', '/spa-probe-path')` → a `$pageview` for `/spa-probe-path` arrived with no document
      navigation. Note for whoever converts the site to `<Link>`: the SDK compares **pathname only**, so a
      query-string-only change is deliberately not a new pageview.
- [x] A real event arrives in the `graflet` project through the proxy host, confirmed by the network tab showing the
      request going to the first-party subdomain, not to `i.posthog.com`. Every request — `config.js`, `/flags/`,
      `/e/`, `/s/`, all four extension bundles — goes to `edge.graflet.rnui.dev`. Zero requests to any
      `*.posthog.com` host. Events queried back out of project 528914 by SQL.
- [ ] With uBlock Origin (or equivalent) enabled, events still arrive — the whole point of ticket 01. If they do
      not, the chosen subdomain or path is already on a blocklist and needs changing; record the finding here.
      **Not verifiable in the test browser: it has no content blocker.** Probed from the page —
      `fetch('https://us.i.posthog.com/static/array.js')` **reached** the network, so nothing is blocking even the
      canonical PostHog host in this profile, and "events arrived" proves nothing about blocker recovery. Left open
      deliberately: someone with uBlock Origin enabled needs to load the deployed site once and confirm `/e/` still
      returns 200. The proxy path itself is confirmed working end to end.
- [x] The provider calls `isAnalyticsOptedOut()` (`apps/web/lib/analytics.ts`, added by ticket 02) **before**
      `posthog.init` and skips init entirely when it returns true. The `/privacy` opt-out button is already live and
      already writes the key — until this box is ticked, the page names a switch the SDK ignores. Verified live, not
      just in a test: clicked the real button on `/privacy`, reloaded, and the fresh load made **zero** requests to
      the proxy and left `window.posthog` undefined. **This is also where the second real bug was — see the comment
      on the two-source-of-truth opt-out below.**
- [x] `next.config.ts` gains **no** PostHog `rewrites` — proxying deliberately does not run through our Worker
      (ADR-0010). No `skipTrailingSlashRedirect` is needed either, since that only applies to the rewrites path.
      `next.config.ts` is untouched.
- [x] Existing `apps/web` tests pass, and the provider is inert under vitest/jsdom (no network calls in tests).
      `npx vitest run` → **86 passed, 0 failed** (7 of them the new `components/analytics-provider.test.tsx`);
      `npm run typecheck` clean. The env vars are read *inside* the effect, not at module scope, so the no-token
      path is what tests exercise by default and `vi.stubEnv` can drive the init path.

## Comments

**2026-07-26** — Two bugs found by verifying in a real browser rather than trusting the config. Both would have
shipped silently, and both are the same shape: a second source of truth we did not know we had.

**1. `defaults: '2026-06-25'` created a person row for every anonymous visitor.** The dated defaults bundle looked
like free future-proofing, so the first version set it. Then `SELECT count() FROM persons WHERE created_at >=
now() - INTERVAL 1 HOUR` came back **199** — on a site that promises "no person row before sign-in". Cause, found
in the SDK source: `defaults >= '2026-01-30'` turns on `internal_or_test_user_hostname:
/^(localhost|127\.0\.0\.1)$/`, and on a matching host the SDK calls `setPersonProperties({$internal_or_test_user:
true})`, which captures a `$set` event. `person_profiles: 'identified_only'` does **not** stop that — the internal
guard only refuses when `person_profiles === 'never'`. So an explicit person-property write beat the
anonymous-by-default setting, on localhost only.

Fix: drop `defaults` and set the one option it was wanted for, `external_scripts_inject_target: 'head'` (the
hydration-safe injection point). A test asserts `defaults` is absent and says why, because the next person to read
the PostHog docs will want to add it back. The 199 rows already in the project are all dev traffic and are tagged
`$internal_or_test_user: true`, so ticket 08's dashboard can exclude them; they are not worth deleting.

The general lesson for this file: a dated defaults bundle imports behaviour nobody in this repo has audited, into
the one code path whose promises are written on a legal page.

**2. The opt-out button could turn analytics off permanently — including for someone who turned it back on.**
Ticket 02's `setAnalyticsOptOut()` pokes `posthog.opt_out_capturing()` so the choice applies without a reload. That
call writes PostHog's *own* consent record, `__ph_opt_in_out_<token>`, to localStorage, and it outlives our
`graflet:analytics-opt-out` key. So: opt out → reload (our key makes the provider skip init) → click *"Turn
analytics back on"* → our key is removed, but `ph?.opt_in_capturing?.()` hits `undefined`, because there is no live
SDK on an opted-out page. Every later visit then initialises an SDK that silently refuses to capture. Caught live —
`is_capturing()` was `false` with our key absent.

Fix in the provider, at the seam where both sources meet: after init, `if (posthog.has_opted_out_capturing())
posthog.clear_opt_in_out_capturing()`. Reaching that line means our key says "not opted out", so any stored PostHog
opt-out is stale by definition. Two details that matter: it is **guarded**, so a first-time visitor's device is
never touched; and it **clears** rather than opting in, because `opt_in_capturing()` writes a `__ph_opt_in_out_*`
record back — which is what /privacy promises does not happen. Known residue, marked in the code: the initial
`$pageview` of that one load is still dropped, because `init` read the stale record before we cleared it. Clearing
pre-init would mean hardcoding PostHog's storage key; not worth it for one pageview for a user who toggled the
switch off and on. Verified by walking the whole round trip in a real browser against a production build: click the
real button → `is_capturing()` false and our key `"1"`; delete our key only (what "turn back on" does with no live
SDK) → reload → `is_capturing()` **true**, `has_opted_out_capturing()` false, recorder loaded, and **zero**
`__ph_opt_in_out_*` records left for this project's token — cleared, not rewritten.

**3. Review (`/code-review-mp`, Standards + Spec axes) changed four more things.** Worth listing because two of them
were promises, not polish:

- *"Stated explicitly" was not true for rage clicks or `$pageleave`* — both were riding on SDK defaults while this
  ticket's box claimed otherwise. Now `rageclick: true` and `capture_pageleave: true` are in the init block. Same
  class of bug as the `defaults` one: correct behaviour, version-coupled, and a false claim in writing.
- *The opt-out repair wrote a key.* The first fix used `opt_in_capturing()`; review pointed out that writes
  `__ph_opt_in_out_<token>` to the device, against the privacy page's enumerated list. Swapped to
  `clear_opt_in_out_capturing()` (see 2 above).
- *`git add -f` is a ritual nobody will remember.* `apps/web/.gitignore` now negates `!.env.production` — the same
  ignore-then-negate pattern the file already uses for `.dev.vars.example`. Ticket 01's last box is closed there.
- *A third env mechanism appeared with no documentation.* `apps/web/README.md` gained an **Env** section: the table
  of the three `NEXT_PUBLIC_*` vars, why `.env.production` is the one tracked `.env*`, that nothing private may go in
  it, and how to opt local dev into real capture.

Two review findings were deliberately **not** acted on. `external_scripts_inject_target: 'head'` appears in no spec
line — it is an implementation detail of not fighting React's head handling, and the comment says so. And the
`AnalyticsProvider` name provides no React context; the component's own docstring concedes that, and it is the word
the ticket and PostHog's own docs use, so churning the name buys nothing.

**4. Review also found a collision this ticket creates for ticket 05, and it is recorded there.**
`persistence: 'memory'` means the anonymous `distinct_id` does not survive the GitHub OAuth round trip, which is a
full document navigation — so ticket 05's *"anonymous events from earlier in the same session appear on the
identified person"* box cannot hold as written, and `spec.md`'s "one timeline" line depends on it. A ⚠ note on that
box in `05-identify-on-signin.md` spells out the two honest ways out. Not fixed here: this ticket's job is the
anonymous half, and quietly widening `persistence` to make a later box easier would break this ticket's own promise.

**Local dev is inert by default, on purpose.** The two `NEXT_PUBLIC_POSTHOG_*` vars live in
`apps/web/.env.production` (now **force-added to git** — ticket 01's last open item; the token is a public
write-only project token). `next dev` and the test suite see no token, so they never capture. To exercise the real
SDK locally, copy those two lines into a gitignored `apps/web/.env.local` — that is what this ticket's verification
did (ticket 01 put `localhost:3000` in `recording_domains` for exactly this). Two things to know before you do:
every local page load lands in the production project, and **`next dev`'s fast refresh re-inits the SDK on each
rebuild** — 24 re-inits in one session here, which is why the `__loaded` guard exists. A production build
(`next build && next start`) initialises exactly once and is the honest thing to verify against.
