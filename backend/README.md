# docs-kg-backend

The always-up Cloudflare Worker backend for the docs-KG CLI (ADR-0004). It holds
the private-repo token, runs GitHub OAuth, and brokers KG downloads. Deploys to
Cloudflare Workers — **never** the VPS (the VPS runs only the daily poller).

**Ticket 01:** the deployable shell — the `CATALOG` D1 binding + the two secrets,
exposed only through health/readiness.
**Ticket 03 (added):** GitHub OAuth (auth-code flow, backend-brokered). The CLI
never holds the client secret; the backend does the code exchange, confirms the
identity, upserts the user, and mints its own bearer token (ADR-0001).

## Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | none | Liveness. `200 "ok"`. The one always-public surface (ADR-0005: only a KG download is gated). |
| `GET /ready` | none | Readiness. Trivial D1 read (`SELECT 1`) + presence of both secrets. Returns booleans only — never a secret value. `200` when wired, `503` otherwise. |
| `POST /auth/cli/start` | none | Begin a browser sign-in. Returns `{ authorize_url, state }`. |
| `GET /auth/cli/callback` | none | GitHub redirects the browser here; the backend exchanges the code, upserts the user, mints the bearer, and shows a close-this-window page. |
| `POST /auth/cli/poll` | none | Body `{state}`. The CLI polls until `{ status: "complete", token, login }` (or `pending` / `error` / `expired`). |

All auth routes are public: sign-in is the path *to* an identity, not gated by
one. Login never sets `marketing_consent` — it stays `unset` (ADR-0006).

## Data (D1 migrations)

`migrations/0001_users_and_tokens.sql` creates the identity tables: `users`
(the core asset, keyed by `github_id`), `tokens` (issued bearers, stored as a
SHA-256 hash — never raw), and `pending_auth` (short-lived browser-handoff rows).
Ticket 02 adds the catalog tables in a later migration.

## Develop & test (no Cloudflare account needed)

```sh
pnpm install          # runs workerd/esbuild build scripts (see pnpm-workspace.yaml)
pnpm run typecheck    # tsc --noEmit
pnpm test             # vitest in workerd/Miniflare — hits /health, /ready, env presence
pnpm dev              # wrangler dev (needs a local .dev.vars, see below)
```

Tests inject fake secret values via `vitest.config.ts`; they do not read `.dev.vars`.

## Secrets & config

Two **secrets**, never committed:

- `PRIVATE_REPO_TOKEN` — GitHub token that reads the private KG repo (ticket 05).
- `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth App client secret, backend-only (ticket 03).

One public **var** (in `wrangler.jsonc`, not a secret — it ends up in the browser
authorize URL): `GITHUB_OAUTH_CLIENT_ID`. Replace the placeholder with your
OAuth App's client id.

Local dev: `cp .dev.vars.example .dev.vars` and fill the secrets. `.dev.vars` is
gitignored; `wrangler dev` auto-loads it.

## Deploy (operator, needs your Cloudflare account)

The two acceptance checks that need a live account are run here:

```sh
# 1. Create the D1 database, then paste the printed database_id into
#    wrangler.jsonc -> d1_databases[0].database_id (replacing the zeros).
pnpm exec wrangler d1 create docs-kg-catalog

# 2. Apply the migrations to the remote DB (creates users/tokens/pending_auth).
pnpm exec wrangler d1 migrations apply docs-kg-catalog --remote

# 3. Register a GitHub OAuth App (operator): Authorization callback URL =
#    https://<worker-url>/auth/cli/callback . Put its Client ID into
#    wrangler.jsonc -> vars.GITHUB_OAUTH_CLIENT_ID, and upload the two secrets
#    (interactive prompt — never pass the value on the CLI):
pnpm exec wrangler secret put PRIVATE_REPO_TOKEN
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_SECRET   # the OAuth App client secret
pnpm exec wrangler secret list          # acceptance: shows both, type secret_text, no values

# 4. Ship it, then hit the public health check.
pnpm run deploy
curl https://<worker-url>/health         # acceptance: 200 "ok", no auth header
```
