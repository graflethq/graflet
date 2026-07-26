# ADR-0010 — PostHog as the analytics processor, behind a managed reverse proxy, with identified persons

**Status:** Accepted (2026-07-26)
**Relates to:** [ADR-0006](0006-consent-and-audience-model.md) (email consent — a *different* legal basis from
analytics processing; neither covers the other) and [ADR-0004](0004-three-box-infrastructure.md) (the boxes the
capture calls are made from).

## Context
Graflet shipped with no analytics of any kind. There is no way to answer the questions that decide what to build
next: does anyone reach `/support`, does the install command actually get copied, which libraries do people search
for and *not* find in the catalog, and does a site visitor ever become a CLI user who downloads a KG.

Three facts shaped the decision:

1. **The audience is developers, so ad blockers are the norm, not the exception.** PostHog's own figure is that a
   reverse proxy recovers **10–30%** of otherwise-blocked events. Straight `posthog-js` against
   `us.i.posthog.com` would silently under-count the exact population we are trying to measure.
2. **The events that matter happen where the browser cannot be trusted.** The gate (ADR-0005) is a KG download
   brokered by the backend Worker, and most downloads happen from the CLI, with no browser present at all.
3. **A pointed-CNAME shortcut does not exist.** PostHog refuses plain custom-domain CNAMEs on the stated grounds
   that "DNS uncloaking would be trivially easy for adblocker extensions" — so the only options were their
   managed proxy or a self-hosted one.

## Decision
- **PostHog Cloud, US region, a dedicated `graflet` project** inside the existing organisation. A credit card goes
  on file (the free tier allows only one project) and **every product's billing limit is set to $0**, so overage is
  structurally impossible rather than merely unlikely. All capture is free-tier: 1M events, 5k session replays,
  1M flag requests, 1.5k survey responses per month.
- **Browser traffic goes through PostHog's managed reverse proxy** on a subdomain of `rnui.dev`. Rejected: a
  self-hosted Cloudflare Worker proxy (a fourth deploy target, and PostHog will not troubleshoot self-hosted
  proxies) and Next.js `rewrites`/`proxy.ts` (routes every event, flag poll, SDK asset **and 1–5 MB session-replay
  chunk** through our own OpenNext Worker — paying Worker invocations to proxy our own analytics).
- **Backend and CLI capture goes direct to `us.i.posthog.com`.** Server-side calls have no ad blocker to defeat,
  so the proxy is a browser-only concern.
- **Anonymous by default, identified on sign-in.** No cookie banner. Pre-login visitors are captured with
  memory-only persistence and `person_profiles: 'identified_only'` — counted, never stored on their device.
  GitHub sign-in — already an explicit act with its own disclosure — is what enables persistence and calls
  `identify()`. Rejected: `cookieless_mode: 'always'`, which forbids `identify()` outright and would have made the
  site→CLI funnel impossible; and a consent banner gating the snippet, which PostHog's own docs warn against
  ("can't count the visitors who ignore the banner… a frequent cause of sudden, large drops in event volume").
- **Identified persons carry `github_id`, GitHub login and email.** Chosen with the trade-off understood: it makes
  persons directly identifiable inside a US third-party store, in exchange for readable person profiles and
  segmentation. This is the decision most likely to be revisited.
- **CLI telemetry is opt-in, asked once.** One prompt on first interactive run, default **no**, answer remembered
  beside the existing credential store. Non-interactive/CI runs never prompt and never send.
  `GRAFLET_TELEMETRY=0` and `DO_NOT_TRACK=1` both hard-disable. Rejected: on-by-default-with-opt-out (what
  Next.js and Homebrew do) — better data, but silent default-on telemetry in an OSS dev tool is a launch-thread
  liability worth more than the numbers.
- **Search terms are captured explicitly.** Autocapture does not record typed text (confirmed by PostHog:
  "PostHog autocapture doesn't capture the text that users enter") and session replay masks inputs by default, so
  a deliberate `catalog_search { query, result_count }` event is the only way to learn demand.
  `result_count === 0` is the missing-doc demand signal.

## Consequences
- **The privacy page had to be rewritten, not amended.** It previously said the site "captures nothing" and that
  data is not shared with third parties. Both became false the moment this shipped. PostHog is now named as a
  processor, with US hosting, the three identifying fields, and session replay all disclosed.
- **Erasure is now a two-system operation.** Deleting a user means deleting our row *and* the PostHog person. That
  is a GDPR obligation, not housekeeping.
- **ADR-0006's marketing consent does not extend to this.** Analytics processing is a separate basis; conflating
  the two in copy or in code would be a compliance error.
- **A blocker on the elegant path is live upstream.** posthog-js#2841: `opt_out_capturing_by_default: true`
  combined with `cookieless_mode: 'on_reject'` sends nothing at all until `opt_out_capturing()` is called. We
  avoid both options, so we are not exposed — but any future move toward a banner must re-check that bug first.
- **Managed proxies have been observed stuck in `erroring`/522.** The fallback is a one-line `api_host` revert to
  `us.i.posthog.com`, which trades the 10–30% recovery for working capture. Accepted.
- Because everything runs on one project token with billing limits at $0, enabling the remaining products
  (feature flags, surveys, error tracking, experiments) is configuration, not architecture.

## Amendment — 2026-07-26 (ticket 05, identify on sign-in)

Building the identify step showed two statements above to be *nearly* right rather than right. Both are corrected
here rather than left to be discovered from the code.

**1. "Pre-login visitors are … counted, never stored on their device" is now false by one entry.**

Sign-in is a full document navigation — out to github.com and back — so the anonymous `distinct_id` held in
memory-only persistence does not survive the round trip. Without it there is no `$anon_distinct_id` to hand
`identify()`, PostHog has nothing to merge, and the visit → sign-in → download funnel this ADR exists to enable
starts on one person and ends on another. The decision above ("no cookie banner, anonymous by default") is only
worth anything if the funnel actually joins up.

So: on the sign-in **click**, one `sessionStorage` entry, `graflet:analytics-anon-id`, holding the random anonymous
id and nothing else. It belongs to one browser tab, is read-and-removed on return, and dies with the tab.

The revised rule: **a visitor who only browses still has nothing written to their device.** The write happens at the
moment someone chooses to sign in — which this ADR already treats as the consent boundary, and which /privacy now
names explicitly rather than letting the old sentence quietly stop being true.

Rejected alternatives: accepting no merge (cheapest, but abandons the funnel and would have meant rewriting the
"one timeline" promise in `spec.md`); and threading the anonymous id through the OAuth `state` round trip on the
backend (nothing on the device at all, but a schema column, a backend change, and the id ends up in a URL).

**2. "GitHub sign-in … is what enables persistence" — true, but not on every load.**

A returning signed-in visitor is now booted straight into their identified id via
`bootstrap: { distinctID, isIdentifiedID: true }` with persistence already on, rather than starting anonymous and
identifying a beat later. The latter mints a throwaway anonymous id on *every* page load and merges it in, growing
the person's alias list without bound. Persistence is still switched on only for someone who has signed in; it is
simply set at `init` rather than after it.

**Two SDK behaviours this depends on, both verified against source rather than assumed** — either would have failed
silently:

- `bootstrap.distinctID` with `isIdentifiedID` unset marks the id *anonymous* (`posthog-core.ts:793-803`), which is
  precisely what makes a later `identify()` emit `$identify` carrying `$anon_distinct_id` (`:2613-2629`). Marking it
  identified instead would skip the merge entirely.
- `person_profiles: 'identified_only'` does **not** defeat the merge. Pre-identify events do carry
  `$process_person_profile: false`, but ingestion writes a `person_distinct_id_overrides` row on merge so those
  personless events resolve to the person anyway (PostHog handbook, *Person processing*: "when a user identifies,
  their previous anonymous events are linked to their new person profile automatically"). A first reading of the SDK
  source concluded the opposite and would have had us drop the carry as pointless.

**3. Identified persons still carry all three fields, but `email` arrives from the Worker.** The browser sends
`identify(github_id, { github_login })`; `signin_completed` carries `$set: { github_login, email }`. Putting the
email in the OAuth return fragment would have kept it out of server logs but still left it in the address bar and in
browser history. The trade-off recorded above — directly identifiable persons in a US third-party store, in exchange
for readable profiles — is unchanged.
