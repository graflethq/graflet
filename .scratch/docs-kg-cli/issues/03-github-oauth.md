# 03 — GitHub OAuth + CLI login/logout

**What to build:** A developer runs `docs-kg login` and the CLI hands off to a GitHub OAuth device/browser flow; they authorize in the browser and return to a signed-in terminal. Behind it, the Cloudflare Worker backend — the only place the OAuth client secret ever lives, never shipped in the OSS CLI — completes the code exchange, calls GitHub to confirm the identity, and upserts a user row keyed by `github_id` (`{github_id, email, created_at}`), the users table being the product's core asset. The backend issues the CLI a bearer token, which the CLI stores in the OS keyring, falling back to a plaintext file where no keyring exists (the gh/supabase pattern); CI and headless use skip the browser through a `--token` flag or env var. `docs-kg logout` forgets the stored token. Sign-in is identity only: it does not ask for marketing consent (that stays `unset` until a later deliberate opt-in), and being logged in gates nothing by itself — the gate is the KG download (ticket 05). What ships here is the identity-and-token machinery the download broker and `watch` later verify.

**Blocked by:** 01.

**Status:** done (branch `cloudflare-workers-ai-kg`). Backend in `backend/` (auth-code
flow, `src/auth.ts` + `src/github.ts` + `migrations/0001`), CLI in `cli/`
(`src/login.ts` + `src/credential-store.ts`). Chose the **auth-code** flow over
device flow so the client secret is genuinely used at the code exchange. Two
operator-gated steps need the live Cloudflare account + a real GitHub OAuth App
(README §Deploy), same pattern as ticket 01.

- [x] `docs-kg login` completes the flow end-to-end: `POST /auth/cli/start` → open browser → GitHub → `GET /auth/cli/callback` (backend-side code exchange with the secret, `/user`+`/user/emails` verify) → CLI polls `/auth/cli/poll` → "Signed in as <login>". Client secret is backend-only (never imported by `cli/`). *Integration-tested in workerd (`backend/src/auth.test.ts`) with GitHub stubbed; live GitHub App is operator-gated.*
- [x] First login creates exactly one `users` row `{github_id, email, created_at}`; a repeat login by the same `github_id` updates it (email refreshed, `created_at` preserved) — no duplicate. *`ON CONFLICT(github_id) DO UPDATE`; asserted both ways.*
- [x] The bearer is stored in the OS keyring (`@napi-rs/keyring`), falling back to a `0600` `~/.config/docs-kg/token` where no keyring exists; `--token`/`DOCS_KG_TOKEN` authenticate with no browser and no keyring write. *`cli/src/credential-store.ts`; `credential-store.test.ts` covers keyring path, file-mode fallback, and resolveToken precedence + no-write.*
- [x] `docs-kg logout` clears both the keyring and the plaintext file. *`clearToken()`; tested.*
- [x] Login never prompts for marketing consent — a freshly signed-in user persists with `marketing_consent = 'unset'` (default, untouched by the upsert). *Asserted on the DB row + on login output.*
- [x] No other command gains an auth requirement: `--help` (and unknown-command usage) run signed-out. *Verified by running the built `dist/index.js --help` → exit 0; no token read on that path.*
