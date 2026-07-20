# 06 — GitHub signup + unchecked marketing opt-in

**What to build:** A visitor can join the audience by clicking "Sign in with GitHub", reusing the backend's OAuth exchange (the same identity the CLI uses; the client secret stays on the Worker and never ships to the browser). The signup carries a single marketing opt-in checkbox, UNCHECKED by default; on completing OAuth the backend upserts the user row and records `marketing_consent` as `yes` if ticked or `no` if left unchecked, stamping `consent_at` and a website `consent_source`. The opt-in prompt renders only while a user's `marketing_consent` is still `unset`, so an already-answered returning user is never re-asked.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] "Sign in with GitHub" runs the backend's OAuth code-exchange (docs-kg-cli ticket 03); the client secret appears in no shipped frontend asset or browser network payload (grep/DevTools verifiable, ADR-0001).
- [ ] The marketing opt-in ships UNCHECKED (the input has no `checked` attribute); a signup submitted without touching it persists `marketing_consent = no`; ticking it persists `yes`; either way a non-null `consent_at` and a website `consent_source` are stamped (ADR-0006).
- [ ] The opt-in prompt renders only while `marketing_consent` is `unset`; a returning user who already answered sees no prompt and their stored value is unchanged.
- [ ] The unchecked-by-default behavior and the no-secret-in-shipped-assets guarantee are covered by tests.
