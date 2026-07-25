# ADR-0009 — Sell an optional supporter licence; supersedes "no paid plans" in ADR-0005

**Status:** Accepted (2026-07-26)
**Supersedes:** the "No paid plans in v1" decision in [ADR-0005](0005-gate-and-free-oss-model.md). Everything else in
ADR-0005 — gate exactly one action, the gate is access-control not a paywall — still holds.

## Context
ADR-0005 deferred money to a "phase-2 decision after there's an audience", with donations via GitHub Sponsors and Buy
Me a Coffee as the interim route. Neither destination ever existed: `buymeacoffee.com/graflethq` 404s and the org has
no sponsors listing, so both shipped as dead buttons and were removed. That left no way at all to fund the work.

Donation platforms were ruled out for a solo developer in Bangladesh (see
`kg-product-research/donation-rails-wise-freemius/`). Freemius was chosen as merchant of record: it handles VAT, acts
as the seller of record, and pays out to a country most donation rails don't serve.

Freemius sells **products**, not donations, and its Acceptable Products policy requires that a paid tier unlock real
product features. A "donate" button dressed as a product would breach that. So the licence has to be a real licence.

The checkout has no custom-amount parameter — `plan_id` / `pricing_id` / `licenses` / `billing_cycle` / `currency` and
nothing else — so a buyer-typed amount is impossible. Ten amounts means ten pricing rows.

## Decision
- Sell **one** optional product: a lifetime **supporter licence**, $10–$100 in ten steps, one-off, never a
  subscription. Freemius is merchant of record.
- **Every tier ships the same files.** The amount buys nothing extra. Tiers are keyed to activation count (1 machine
  at $10 … 100 at $100), which is the only axis Freemius's checkout exposes, and the page says outright that a higher
  tier "does not unlock anything held back from the $10 tier".
- **Nothing moves behind the payment.** The CLI, the docs, the graphs and the catalog stay free for everyone. ADR-0005's
  single gate — GitHub sign-in on the KG download — is unchanged and is still not a payment.
- One plan with ten pricing rows, not ten plans. Freemius's own dashboard warns against splitting multi-unit licence
  prices across plans.
- The route is **`/support`**, not `/pricing`. Nothing on it is priced; "pricing" implies a feature ladder that does
  not exist.
- Refunds: 30 days, in full, no questions asked (Freemius "Flexible / Double Guarantee"), documented at `/refunds`.

## Consequences
- The landing page can no longer say "no paid plans — ever". It now says the true thing: nothing is paywalled, a star
  is the ask, and the licence is optional and unlocks nothing. Any copy that contradicts a live checkout is a
  liability during merchant review, not just an inconsistency.
- Buyers receive a welcome pack (`docs/supporter/START-HERE.md` + the badge), hosted on our own domain because
  Freemius takes a download **URL** and does not host files. Its first paragraph tells the buyer everything is free
  and offers the refund, unprompted.
- Success is no longer measured only as stars + list size. It now includes revenue — but revenue must never become a
  reason to move something from the free side to the paid side. If that trade ever looks tempting, this ADR is the
  thing to reopen.
- ADR-0005's phase-2 framing is spent. A future paid *feature* (an MCP service, hosted graphs) would be a new ADR and
  a new argument; it does not inherit permission from this one.
