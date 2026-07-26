# Spec — PostHog analytics across site, backend and CLI

**Status:** design settled by grilling 2026-07-26. Not yet built.
**Source of truth for the *why*:** [ADR-0010](../../docs/adr/0010-posthog-analytics.md) + the glossary in
`CONTEXT.md`. This file is the *what to build*.

---

## Goal

Answer five questions that currently have no answer:

1. Does anyone actually copy the install command, and from which page?
2. Which libraries do people search the catalog for and **not find**? (the missing-doc demand signal)
3. Does a site visitor ever become a signed-in user who downloads a KG? Where do they drop?
4. Is anything broken in production for real users (failed catalog fetches, failed downloads)?
5. Do people reach `/support` at all, and from where?

Non-goal: revenue attribution. The success metric is still audience + stars (CONTEXT.md).

---

## Shape

```
Browser (graflet.rnui.dev)
   posthog-js ──► managed reverse proxy (subdomain of rnui.dev) ──► us.i.posthog.com
   anonymous by default · identified on GitHub sign-in

Backend Worker (api.graflet.rnui.dev)
   posthog-node ──────────────────────────────────────────────► us.i.posthog.com
   flushAt: 1, flushInterval: 0  (a Worker can terminate before a batch flushes)

CLI (@graflethq/cli)
   posthog-node ──────────────────────────────────────────────► us.i.posthog.com
   only when opted in · never in a non-interactive run
```

**One project token, one namespace, three senders.** `distinct_id` is the numeric `github_id` once known, so a
person's site visit, backend download and CLI run land on one timeline and one funnel.

Region: **US** (`us.i.posthog.com`), project `graflet` inside the existing org. Billing limit **$0** on every
product.

---

## Event taxonomy

`snake_case`. Every property listed is required unless marked optional.

### Browser — automatic
`$pageview`, `$pageleave`, autocapture (clicks/inputs — **element text only, never typed values**), rage clicks,
heatmaps, session replay (default input masking kept), `$exception`.

### Browser — explicit
| Event | Properties | Fired from |
|---|---|---|
| `catalog_search` | `query` (lowercased, truncated 64), `result_count` | `apps/web/components/catalog-section.tsx` — debounced |
| `command_copied` | `doc`, `version`, `surface` (`hero` \| `catalog_row`) | `apps/web/components/copy-button.tsx` |
| `doc_row_click` | `doc`, `version` | `apps/web/components/catalog-section.tsx` |
| `signin_started` | `surface` | `apps/web/components/join-panel.tsx` |
| `support_click` | `tier` | `apps/web/components/support-tiers.tsx` — split out of `/support`, which stays a server component |

### Backend Worker
| Event | Properties | Fired from |
|---|---|---|
| `signin_completed` | `is_new_user`, `surface` (`website` \| `cli`), `$set: { github_login, email }` | `apps/backend/src/auth.ts` — both callbacks |
| `kg_download_brokered` | `doc`, `version`, `sha`, `bytes` | `apps/backend/src/broker.ts` |
| `download_failed` | `reason`, `doc`, `version` | `apps/backend/src/broker.ts` |
| `watch_created` | `doc` | `apps/backend/src/watch.ts` — only on an actual insert; the endpoint is idempotent |
| ~~`watch_removed`~~ | — | **not built (ticket 06): there is no unwatch endpoint to fire it from** |
| exceptions | — | `captureException` in catch blocks |

### CLI (opt-in only)
| Event | Properties |
|---|---|
| `cli_command_run` | `command`, `cli_version` |
| `cli_login_completed` | — |
| `cli_download_completed` | `doc`, `version`, `duration_ms`, `bytes` |
| `cli_download_failed` | `reason` |

Three properties above were added during ticket 06 and are not in the original list. `surface` separates a website
sign-in from a CLI one, which the funnel needs and nothing else records; `doc`/`version` on `download_failed` say
*which* download broke, without which the event answers none of the five questions. `$set` is how ticket 05's third
identifying field reaches PostHog without riding through the browser.

**Deliberately not captured:** a per-request `catalog_served` event. That is request logging, not a product event;
Workers observability already has it, and it would dominate the event count.

**A blind spot worth naming:** a download rejected with 401 fires nothing, because an unauthenticated caller has no
`github_id` to attribute it to. That is right for a random probe of a public URL and wrong for the commonest real
failure — a CLI user whose bearer expired. Neither this nor anything else currently sees that case.

---

## Identity rules

- Before sign-in: anonymous, `persistence: 'memory'`, `person_profiles: 'identified_only'`. Nothing written to the
  visitor's device; no person row created.
- On sign-in: switch persistence on, `identify(github_id, { github_login })`. Backend and CLI use the same
  `github_id` as `distinct_id`.
- **`email` is set from the Worker, not the browser** (ticket 05, built 2026-07-26). The site would have had to
  carry it in the OAuth return fragment, which stays out of server logs but still lands in the address bar and in
  browser history. `signin_completed` carries `$set: { github_login, email }` instead. PostHog holds the same three
  fields either way.
- **Sign-in is a full document navigation**, so the anonymous `distinct_id` does not survive the trip to GitHub on
  memory-only persistence. It is parked in `sessionStorage` on the sign-in click and replayed as
  `bootstrap: { distinctID }`, which is what makes `identify()` emit `$anon_distinct_id` and the merge real. Without
  that carry the funnel below would start on one person and end on another.
- Before login the CLI has no id — it uses a machine-local random id and `$identify`s it at login, the same
  anonymous→identified merge the browser does.

## Privacy obligations (not optional)

- `apps/web/app/(legal)/privacy/page.tsx` is **rewritten**, not patched. It currently says the site captures
  nothing and that data is not shared with third parties — false once this ships. It must name PostHog, the US
  region, the three identifying fields, session replay, and how to opt out.
- Account erasure deletes the PostHog person as well as our row.
- Marketing consent (ADR-0006) is a separate basis and must not be presented as covering analytics.

## Products enabled

All on free tier, all with a $0 billing limit: product analytics, web analytics, session replay, heatmaps, error
tracking, feature flags, surveys, experiments. Flags and surveys are switched on but carry no shipped flag or
survey yet — enabling them is configuration, so the cost of turning them on now is a poll request per pageview,
paid out of the 1M/month free allowance.

## Known upstream hazards

- **posthog-js#2841** — `opt_out_capturing_by_default: true` + `cookieless_mode: 'on_reject'` sends nothing until
  `opt_out_capturing()` runs. We use neither option. Re-check before ever adding a banner.
- **Managed proxy stuck `erroring`/522** — reported by multiple users. Fallback: set `api_host` back to
  `us.i.posthog.com` and redeploy.
- **Autocapture never records typed text**, and replay masks inputs. Search terms exist only because of the
  explicit `catalog_search` event.
- The CNAME for the managed proxy must be **DNS-only (grey cloud)**. The repo's wrangler token cannot write DNS,
  so it is an operator step in the Cloudflare dashboard.
- **The proxy does not save session replay.** Measured on the live site (ticket 03, 2026-07-26): with a tracking
  blocker on, blockers kill `posthog-recorder.js` and `dead-clicks-autocapture.js` by **filename**, so serving them
  from a first-party host changes nothing. Events, flags, surveys and exception capture do get through. Treat replay
  and `$dead_click` as **partial-coverage** signals — never as a denominator — and don't debug a thin replay list as
  a wiring bug.
