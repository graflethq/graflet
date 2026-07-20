# 07 — Website signup + unchecked marketing opt-in

**What to build:** A visitor on the website can join the audience by clicking a GitHub sign-in button — the same GitHub OAuth identity the CLI uses, reusing ticket 03's backend code-exchange endpoint (the client secret stays on the Cloudflare backend and is never present in the page, ADR-0001). The signup form carries a single marketing opt-in checkbox that is UNCHECKED by default (a pre-checked box is illegal in the EU/UK — rejected in ADR-0006); the visitor may leave it or tick it. On completing OAuth the backend upserts their user row (`{github_id, email, created_at}` — the same upsert as 03; capturing the email is deliberately not treated as consent) and records `marketing_consent` as `yes` if ticked or `no` if left unchecked, stamping `consent_at` and a `consent_source` marking the website signup capture point (the other being CLI notification-setup, ticket 08). Because consent is tri-state, the opt-in prompt renders only while a user's `marketing_consent` is still `unset`, so a returning signed-in user who already answered is never re-asked and their value is untouched. Browsing the catalog and copying the command stay free (06); signing up here simply adds the person to the consented email list.

**Blocked by:** 03 (reuses its OAuth exchange + user-row upsert), 06 (the site to sign up on).

**Status:** ready-for-agent

- [ ] The marketing opt-in checkbox renders UNCHECKED by default (the input ships with no `checked` attribute), and a signup submitted without touching it persists `marketing_consent = no`.
- [ ] Completing GitHub OAuth upserts a user row `{github_id, email, created_at}` via ticket 03's backend endpoint even when the opt-in is left unchecked — the email is captured but consent is not implied by sign-in alone.
- [ ] Ticking the opt-in stores `marketing_consent = yes`, leaving it unchecked stores `no`; either way a non-null `consent_at` and a `consent_source` identifying the website signup are stamped.
- [ ] The opt-in prompt appears only when `marketing_consent` is `unset`; a user who already answered (yes or no) signing in again sees no consent prompt and their stored value is unchanged.
- [ ] The GitHub OAuth code exchange runs server-side on the Worker using the backend-held client secret — the secret appears in no shipped frontend asset or browser network payload (grep/DevTools verifiable).
