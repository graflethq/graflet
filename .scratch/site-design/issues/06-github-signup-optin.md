# 06 — GitHub signup + unchecked marketing opt-in

**What to build:** A visitor can join the audience by clicking "Sign in with GitHub", reusing the backend's OAuth exchange (the same identity the CLI uses; the client secret stays on the Worker and never ships to the browser). The signup carries a single marketing opt-in checkbox, UNCHECKED by default; on completing OAuth the backend upserts the user row and records `marketing_consent` as `yes` if ticked or `no` if left unchecked, stamping `consent_at` and a website `consent_source`. The opt-in prompt renders only while a user's `marketing_consent` is still `unset`, so an already-answered returning user is never re-asked.

**Blocked by:** 01, 02.

**Status:** done (2026-07-21) — backend `/auth/web/start`+`/auth/web/callback` (redirect flow, no CORS, no bearer in browser); frontend `/join` + `JoinPanel`. Consent recorded server-side in the callback, guarded to `unset`.

- [x] "Sign in with GitHub" runs the backend's OAuth code-exchange (graflet-cli ticket 03); the client secret appears in no shipped frontend asset or browser network payload (grep/DevTools verifiable, ADR-0001). — exchange runs in `/auth/web/callback`; frontend only navigates to `/auth/web/start`; test asserts the authorize URL carries no secret.
- [x] The marketing opt-in ships UNCHECKED (the input has no `checked` attribute); a signup submitted without touching it persists `marketing_consent = no`; ticking it persists `yes`; either way a non-null `consent_at` and a website `consent_source` are stamped (ADR-0006).
- [x] The opt-in prompt renders only while `marketing_consent` is `unset`; a returning user who already answered sees no prompt and their stored value is unchanged. — backend guard `WHERE marketing_consent = 'unset'` protects the stored value; the callback reports the stored value back so the UI shows the signed-in view. Note: the pre-sign-in prompt is gated per-device (localStorage), since no bearer ships to the browser to pre-check consent — the guard is the enforcement.
- [x] The unchecked-by-default behavior and the no-secret-in-shipped-assets guarantee are covered by tests. — `join-panel.test.tsx` (unchecked default, consent in link) + `auth.test.ts` (server-side exchange, no secret in authorize URL, guarded consent).
