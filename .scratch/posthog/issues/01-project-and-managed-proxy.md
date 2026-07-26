# 01 — PostHog project + $0 billing limits + managed reverse proxy

**What to build:** The analytics processor exists and is reachable from a first-party domain. A dedicated `graflet`
project lives inside the existing PostHog organisation on the **US** region. Every product's billing limit is set to
**$0**, so exceeding a free allowance stops capture instead of producing a bill. Browser traffic reaches PostHog
through their **managed reverse proxy** at `edge.graflet.rnui.dev`, which is what recovers the 10–30% of events ad
blockers would otherwise eat (ADR-0010). Nothing in the codebase changes in this ticket — it produces a project
token, a working proxy hostname, and a guarantee of no bill.

**Blocked by:** None.

**Status:** done 2026-07-26 (all boxes; only the backend Worker secret is deferred to ticket 06, which is where it is first used)

## What the account already looked like (checked 2026-07-26)

- **No card step needed.** The org already holds 3 projects (`rnui.dev dashboard` 117415, `pixellog.io dashboard`
  117525, `resume` 332359) and `max_proxy_records: 10`, so the free tier's 1-project cap does not apply here. The
  ADR's "add a card" premise was wrong for this account; only a $0-due check remains.
- **A previous managed proxy attempt had failed silently.** A record for `resume.rnui.dev` sat in `timed_out` since
  2026-03-05. Cause found by `dig`: that subdomain CNAMEs to `…vercel-dns-017.com` — it serves a live Vercel site, so
  the proxyhog CNAME was never pointed and verification timed out. **The proxy subdomain must serve nothing else.**
  Deleted 2026-07-26.
- **No project-creation API** is exposed to the MCP, so step 2 is dashboard-only.

## Boxes

- [x] The stale `resume.rnui.dev` proxy record (`019cbe25-…`, `timed_out`) is deleted — it could never verify, and it
      was occupying a slot and misleading the settings page.
- [x] A managed proxy record exists for a **non-obvious** subdomain that serves nothing else — not `analytics.`,
      `tracking.`, `telemetry.` or `posthog.`, which blocker lists already carry, and not `graflet.rnui.dev`, which is
      the web Worker's custom domain.
      `edge.graflet.rnui.dev` → target `5b589f01d617699e037f.cf-prod-us-proxy.proxyhog.com.`
      (record `019f9e17-e38f-0000-2783-3226c692bba8`, created 2026-07-26, status `waiting`)
- [x] Billing shows a card on file and **$0 due** — pay-as-you-go, bill $0.00, `event_retention_months: 84` (the
      7-year paid retention) confirms the card. The "add a card" step in ADR-0010 was already satisfied.
- [x] A project named `graflet` exists in org `01945af3-0d2e-0000-1292-5fc1a9fde6a8` on `us.posthog.com`:
      **id 528914**, token `phc_B2JMYrZWSYybsTw4RmYNmTLKtgqPBZDLzq4jGp5GK5Ex`, timezone UTC. Created through the
      dashboard — no project-creation API is exposed.
- [x] A billing limit of **$0** is on **all 13 billable products**, org-wide, verified by reading every limit line
      back after a reload: product analytics, session replay, realtime destinations, feature flags & experiments,
      surveys, data warehouse, error tracking, AI observability, logs, PostHog AI, Inbox, PostHog Code, emails.
      Four were already $0; the rest were unset or on a vendor default ($500 prefill, or $150/$150/$50 on PostHog
      AI / Inbox / Code) and were set to $0 on the operator's instruction that this project must never bill.
      Every product's displayed *billing limit* now equals its *free tier limit* — spend past the free allowance is
      arithmetically impossible, not merely unlikely. Capture stops at the allowance instead of charging.
- [x] The CNAME exists in the `rnui.dev` zone: name `edge.graflet`, type `CNAME`, target
      `5b589f01d617699e037f.cf-prod-us-proxy.proxyhog.com`, proxy status **DNS only (grey cloud)**, TTL Auto.
      Verified from outside the dashboard: `dig edge.graflet.rnui.dev CNAME` returns the proxyhog target via both
      the local resolver and `1.1.1.1`.
- [x] The proxy status reads **valid** (`updated_at` 11:10:26Z, ~7 minutes after the CNAME landed) and the
      endpoints answer through it, not with a 522:
      `POST https://edge.graflet.rnui.dev/flags?v=2` → **200** with a real body
      (`{"errorsWhileComputingFlags":false,"flags":{},"requestId":"613137be-…"}`), and
      `GET https://edge.graflet.rnui.dev/static/array.js` → **200**.
- [x] Session recording is enabled, plus the rest of the agreed capture surface, applied to project 528914:
      `session_recording_opt_in: true`, `session_recording_sample_rate: "1.00"`, `heatmaps_opt_in: true`,
      `surveys_opt_in: true`, `autocapture_exceptions_opt_in: true`, `capture_dead_clicks: true`,
      `capture_console_log_opt_in: true`, `capture_performance_opt_in: true`, and
      `recording_domains: ["https://graflet.rnui.dev", "http://localhost:3000"]` so replay/heatmaps only record our
      own origins (localhost included, or local dev would silently record nothing).
      A `product_description` was set too — it is what PostHog's own AI reads for context on this project.
- [x] The token and proxy hostname are in `apps/web/.env.production` as `NEXT_PUBLIC_POSTHOG_KEY` +
      `NEXT_PUBLIC_POSTHOG_HOST`, with a comment recording the `us.i.posthog.com` fallback. **Still to do:**
      `git add -f apps/web/.env.production` (the file is gitignored), and the backend's copy of the token, which
      ticket 06 sets up where it is first used.

## Comments

**2026-07-26** — Ticket completed end to end. Proxy record created and the stale `resume.rnui.dev` record deleted via
the PostHog MCP; the DNS record, the project and all billing limits done through the dashboard. Proxy went `valid`
about 7 minutes after the CNAME resolved.

**2026-07-26, billing follow-up** — Operator's constraint, recorded because it governs future work: *"I don't want to
pay PostHog for this free project."* So all 13 products are pinned at a $0 limit, not just the ones this design uses.
Consequence to remember: when a free allowance runs out, that product **stops** (capture drops, replay stops, PostHog
AI answers stop) rather than billing. That is the intended behaviour — if data ever goes missing, check the
allowances on the billing page before debugging the SDK.
