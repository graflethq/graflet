# docs-kg-backend

The always-up Cloudflare Worker backend for the docs-KG CLI (ADR-0004). It holds
the private-repo token, runs GitHub OAuth, and brokers KG downloads. Deploys to
Cloudflare Workers — **never** the VPS (the VPS runs only the daily poller).

**Ticket 01 (this):** the deployable shell. It wires the three runtime deps that
tickets 02 (catalog store), 03 (OAuth), and 05 (download broker) build on — the
`CATALOG` D1 binding and the two secrets — and exposes only health/readiness.

## Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | none | Liveness. `200 "ok"`. The one always-public surface (ADR-0005: only a KG download is gated). |
| `GET /ready` | none | Readiness. Trivial D1 read (`SELECT 1`) + presence of both secrets. Returns booleans only — never a secret value. `200` when wired, `503` otherwise. |

## Develop & test (no Cloudflare account needed)

```sh
pnpm install          # runs workerd/esbuild build scripts (see pnpm-workspace.yaml)
pnpm run typecheck    # tsc --noEmit
pnpm test             # vitest in workerd/Miniflare — hits /health, /ready, env presence
pnpm dev              # wrangler dev (needs a local .dev.vars, see below)
```

Tests inject fake secret values via `vitest.config.ts`; they do not read `.dev.vars`.

## Secrets

Two secrets, never committed:

- `PRIVATE_REPO_TOKEN` — GitHub token that reads the private KG repo (ticket 05).
- `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth App client secret, backend-only (ticket 03).

Local dev: `cp .dev.vars.example .dev.vars` and fill real values. `.dev.vars` is
gitignored; `wrangler dev` auto-loads it.

## Deploy (operator, needs your Cloudflare account)

The two acceptance checks that need a live account are run here:

```sh
# 1. Create the D1 database, then paste the printed database_id into
#    wrangler.jsonc -> d1_databases[0].database_id (replacing the zeros).
pnpm exec wrangler d1 create docs-kg-catalog

# 2. Upload the two secrets (interactive prompt — never pass the value on the CLI).
pnpm exec wrangler secret put PRIVATE_REPO_TOKEN
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
pnpm exec wrangler secret list          # acceptance: shows both, type secret_text, no values

# 3. Ship it, then hit the public health check.
pnpm run deploy
curl https://<worker-url>/health         # acceptance: 200 "ok", no auth header
```
