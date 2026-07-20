# docs-kg-backend

The always-up Cloudflare Worker backend for the docs-KG CLI (ADR-0004). It holds
the private-repo token, runs GitHub OAuth, and brokers KG downloads. Deploys to
Cloudflare Workers — **never** the VPS (the VPS runs only the daily poller).

**Ticket 01:** the deployable shell — the `CATALOG` D1 binding + the two secrets,
exposed only through health/readiness.
**Ticket 03 (added):** GitHub OAuth (auth-code flow, backend-brokered). The CLI
never holds the client secret; the backend does the code exchange, confirms the
identity, upserts the user, and mints its own bearer token (ADR-0001).
**Ticket 02 (added):** the catalog — one authoritative list of the launch docs the
website + CLI read with no sign-in, kept live by the pipeline + poller (ADR-0002/0003).

## Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | none | Liveness. `200 "ok"`. The one always-public surface (ADR-0005: only a KG download is gated). |
| `GET /ready` | none | Readiness. Trivial D1 read (`SELECT 1`) + presence of all three secrets. Returns booleans only — never a secret value. `200` when wired, `503` otherwise. |
| `POST /auth/cli/start` | none | Begin a browser sign-in. Returns `{ authorize_url, state }`. |
| `GET /auth/cli/callback` | none | GitHub redirects the browser here; the backend exchanges the code, upserts the user, mints the bearer, and shows a close-this-window page. |
| `POST /auth/cli/poll` | none | Body `{state}`. The CLI polls until `{ status: "complete", token, login }` (or `pending` / `error` / `expired`). |
| `GET /catalog` | none | Docs with a servable (`ready`) latest version, ordered by popularity. Each: `slug, name, license, popularity_rank, latest_version, hero_savings`. |
| `GET /catalog/{slug}` | none | Doc detail: every tracked version (old ones kept, ADR-0003) + a `resolve` for `{slug, version}` (`?version=`, default latest) → `{repo_url, sha, docs_path, kg_ref}` only — the pin the CLI feeds codeload, never KG bytes. `404` for an unknown slug; `resolve` is `null` for a not-yet-`ready` version. |
| `POST /catalog/upsert` | `Authorization: Bearer <CATALOG_UPSERT_SECRET>` | The pipeline/poller upsert a doc/version, flipping `graphifying → ready` and filling `savings/graphscore/sha/license`. Idempotent. A non-green license is refused (`422`); a `needs_human` version is held `provisional`; a new latest version appends a row and flips the alias, leaving older frozen versions untouched. |

All auth routes are public: sign-in is the path *to* an identity, not gated by
one. Login never sets `marketing_consent` — it stays `unset` (ADR-0006).

## Data (D1 migrations)

`migrations/0001_users_and_tokens.sql` creates the identity tables: `users`
(the core asset, keyed by `github_id`), `tokens` (issued bearers, stored as a
SHA-256 hash — never raw), and `pending_auth` (short-lived browser-handoff rows).

`migrations/0002_catalog.sql` creates the catalog tables: `docs` (one row per
library — the CLI slug) and `doc_versions` (one frozen row per `(slug, version_label)`;
old versions are kept, `is_latest` is a moving alias, at most one per slug). The
immutable pin `{sha, docs_path, kg_ref}` is `NULL` until a build records it via
`/catalog/upsert` (it needs the re-graphify from pinned HEADs — kg-pipeline P1).

### Seed the catalog (bootstrap)

`scripts/seed_catalog.py` joins `kg-pipeline/manifest.jsonl` (the `done` docs) with
`research/context7-legality/programming-docs.db` (repo_url, version_label, needs_human)
and writes an idempotent `catalog-seed.sql`. Only green-licensed docs seed `ready`;
`needs_human`/non-green are held `provisional` and never served. Re-running never
clobbers a pin/savings a later upsert filled in.

```sh
python3 scripts/seed_catalog.py                                  # writes catalog-seed.sql
pnpm exec wrangler d1 execute docs-kg-catalog --file=catalog-seed.sql --remote
```

## Develop & test (no Cloudflare account needed)

```sh
pnpm install          # runs workerd/esbuild build scripts (see pnpm-workspace.yaml)
pnpm run typecheck    # tsc --noEmit
pnpm test             # vitest in workerd/Miniflare — hits /health, /ready, env presence
pnpm dev              # wrangler dev (needs a local .dev.vars, see below)
```

Tests inject fake secret values via `vitest.config.ts`; they do not read `.dev.vars`.

## Secrets & config

Three **secrets**, never committed:

- `PRIVATE_REPO_TOKEN` — GitHub token that reads the private KG repo (ticket 05).
- `GITHUB_OAUTH_CLIENT_SECRET` — GitHub OAuth App client secret, backend-only (ticket 03).
- `CATALOG_UPSERT_SECRET` — bearer the pipeline + poller present to `/catalog/upsert` (ticket 02).

Public **vars** live in `wrangler.jsonc` (not secrets — browser-visible by design):
- `GITHUB_OAUTH_CLIENT_ID` — ends up in the browser authorize URL; replace the placeholder with your OAuth App's client id.
- `SITE_ORIGINS` — comma-separated allow-list of website origins granted CORS on the read-only catalog endpoints (`GET /catalog`, `GET /catalog/{slug}`); prod origin + local dev. No other route is CORS-opened (ticket 02 site slice).

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
pnpm exec wrangler secret put CATALOG_UPSERT_SECRET        # any high-entropy shared secret
pnpm exec wrangler secret list          # acceptance: shows all three, type secret_text, no values

# 4. Ship it, then hit the public health check.
pnpm run deploy
curl https://<worker-url>/health         # acceptance: 200 "ok", no auth header
```
