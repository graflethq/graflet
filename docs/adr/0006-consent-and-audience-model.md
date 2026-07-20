# ADR-0006 — Consent + audience model

**Status:** Accepted (2026-07-20)

## Context
The users table is the core asset. But an email captured at sign-in is **not** marketing consent — Google's
policy, GDPR, and CAN-SPAM all require separate, explicit consent, and an unlawful send can get the sending
domain suspended (killing even the emails people asked for). The audience is global (GitHub), so EU rules apply.

## Decision
- **Persist every sign-in** as a user row (`github_id, email, created_at`). That table is the product's core
  asset.
- **Three email types, treated differently:**
  - *Transactional* (download ready, security) — allowed, no marketing consent.
  - *Service / notification* (a watched doc's KG updated) — allowed; the user opted into that stream.
  - *Marketing / broadcast* (a new product) — requires explicit opt-in.
- **Marketing consent = an unchecked opt-in box** (GDPR-valid; pre-checked is illegal in the EU/UK — rejected),
  with **global sends**.
- Consent is captured at **two points**: website signup **and** CLI notification-setup (a deliberate action, so
  it doesn't clutter the OAuth flow) — which reaches CLI-first users who never visit the site.
- The prompt shows **only when consent is unset** — never re-asked once answered either way.
- Product-promo footers in notification emails render **only** for `marketing_consent = yes` recipients (a
  conditional block on the stored flag).

## Consequences
- `marketing_consent` is tri-state (`unset` / `yes` / `no`) with `consent_at` + `consent_source`.
- Notifications are the durable, legal in-inbox channel (service email, no marketing consent needed) — the real
  reach engine, not the marketing box.
- Emails carry a postal address + one-click unsubscribe once any promo is present.
- Reach ceiling accepted: pure-CLI users who decline the opt-in are reachable only via notifications, not
  marketing.
