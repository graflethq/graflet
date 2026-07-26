# PostHog analytics — ticket index

Source of truth: `../../../CONTEXT.md` + [ADR-0010](../../../docs/adr/0010-posthog-analytics.md) + `../spec.md`.
Tracker: local files, one ticket per file. Work the **frontier** — any ticket whose blockers are all done — one at a
time with `/implement`, clearing context between tickets.

## Tickets

| # | Title | Blocked by |
|---|---|---|
| 01 | PostHog project + $0 billing limits + managed reverse proxy ✅ **done 2026-07-26** (project 528914; proxy `edge.graflet.rnui.dev` = `valid`, flags + assets 200) | — |
| 02 | Privacy page rewrite + erasure path ✅ **done 2026-07-26** (no delete path exists — gap recorded, page promises none; opt-out seam = `lib/analytics.ts`) | — |
| 03 | Site SDK wiring — anonymous by default, proxy host, replay + error tracking ✅ **done 2026-07-26** (`components/analytics-provider.tsx`; no `defaults` bundle — it created a person row per anonymous load; uBlock box left open, test browser has no blocker) | 01, 02 |
| 04 | Site explicit events + `catalog_search` demand signal ✅ **done 2026-07-26** (all five through `capture()` in `lib/analytics.ts`; `doc_row_click` had no trigger — rows aren't links — so it fires from a row `onClick` that skips clicks on the copy button; support tiers split into a client component) | 03 |
| 05 | Identify on sign-in — `github_id` + login + email ✅ **done + verified live 2026-07-26** (anon id carried across the OAuth trip in `sessionStorage` → `bootstrap.distinctID`; merge confirmed on production — pre-sign-in and Worker events share one `person_id`. `email` moved to the Worker's `$set` rather than riding in the callback URL) | 03 |
| 06 | Backend Worker server-side capture + `captureException` ✅ **done + deployed 2026-07-26** (`src/analytics.ts`, `posthog-node` workerd export — no `nodejs_compat`; `ctx.waitUntil` not `await`; `watch_removed` has no endpoint to fire from) | 01, 02 |
| 07 | CLI opt-in telemetry (one prompt, `DO_NOT_TRACK`, kill switch) ✅ **built 2026-07-26, not yet published** (`packages/cli/src/telemetry.ts`; no `posthog-node` — a `fetch` POST to `/i/v0/e/`; needed backend migration 0007 so poll returns `github_id`; `logout` also forgets the telemetry identity. Operator: deploy the Worker, then tag `v0.4.0`) | 01, 02, 06 |
| 08 | Dashboard: missing-doc demand list + site→CLI funnel | 04, 06, 07 |
| 09 | Account deletion — erase our row **and** the PostHog person | 06 |

## Dependency order

```
01 (operator: project, card, proxy) ─┬─► 03 ─┬─► 04 ─┐
02 (privacy page — legal gate)  ─────┘      └─► 05   ├─► 08
                                     └─► 06 ─┬─► 07 ───┘
                                             └─► 09
```

**02 is a hard gate on shipping, not a nicety.** No capture reaches production before the privacy page is true.
03/04/05 may be developed locally against the project token first, but must not deploy ahead of 02.

## Operator-gated boxes

Anything needing the Cloudflare dashboard (the DNS-only CNAME) or the PostHog billing page (the card, the $0
limits) cannot be done from this repo — the wrangler token cannot write DNS. Those boxes are marked **(operator)**
and left unchecked until you confirm them.
