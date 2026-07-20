# 03 — GitHub OAuth + CLI login/logout

**What to build:** A developer runs `docs-kg login` and the CLI hands off to a GitHub OAuth device/browser flow; they authorize in the browser and return to a signed-in terminal. Behind it, the Cloudflare Worker backend — the only place the OAuth client secret ever lives, never shipped in the OSS CLI — completes the code exchange, calls GitHub to confirm the identity, and upserts a user row keyed by `github_id` (`{github_id, email, created_at}`), the users table being the product's core asset. The backend issues the CLI a bearer token, which the CLI stores in the OS keyring, falling back to a plaintext file where no keyring exists (the gh/supabase pattern); CI and headless use skip the browser through a `--token` flag or env var. `docs-kg logout` forgets the stored token. Sign-in is identity only: it does not ask for marketing consent (that stays `unset` until a later deliberate opt-in), and being logged in gates nothing by itself — the gate is the KG download (ticket 05). What ships here is the identity-and-token machinery the download broker and `watch` later verify.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `docs-kg login` completes a GitHub OAuth device/browser flow end-to-end: browser handoff to GitHub, backend-side code exchange and identity verification (the client secret lives only on the backend, absent from the OSS CLI), and the terminal reports signed-in.
- [ ] First-time login creates exactly one user row `{github_id, email, created_at}`; a second login by the same GitHub account updates that row rather than duplicating it (upsert keyed by `github_id`).
- [ ] The issued bearer token is stored in the OS keyring; on a host/CI with no keyring it falls back to a plaintext file; and a `--token`/env-var path authenticates with no browser and no keyring write.
- [ ] `docs-kg logout` removes the stored token from both the keyring and the plaintext fallback, so the next call is unauthenticated.
- [ ] The login flow never prompts for marketing consent — a freshly signed-in user persists with `marketing_consent = unset` (ADR-0006); consent is captured only later at website signup (07) or CLI watch-setup (08).
- [ ] Neither `login` nor `logout` adds an auth requirement to any other command: `--help` runs signed-out, honoring gate-only-the-download (ADR-0005).
