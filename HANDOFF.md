# Handoff — Graflet rebrand + live Cloudflare deploy (2026-07-22)

Continue-tomorrow notes for a fresh agent. Full operational detail lives in the
memory file `graflet-site-deployed-cloudflare` — read it first; this doc is the
map, not the territory.

## TL;DR

The product is **live**. `docs-kg → graflet` rename is **complete** across the
main repo. **One placeholder remains** and it needs the human. The catalog is
empty because the KG pipeline hasn't built any docs yet.

## What's live (verified this session)

| Thing | URL / name | State |
|---|---|---|
| Marketing + catalog site | https://graflet.rnui.dev | ✅ live, fully rebranded |
| Backend API | https://api.graflet.rnui.dev | ✅ live |
| Catalog (`GET /catalog`) | — | ✅ returns `{"docs":[]}` (empty) |
| GitHub sign-in (`/auth/*`) | OAuth App "Graflet" | ✅ wired + verified redirect |
| Email (Resend) | sender `updates@rnui.dev` | ✅ wired (idle) |
| Downloads (private bundles) | repo `graflethq/kg-bundles` | ✅ wired (empty repo) |

Cloudflare workers: `graflet-web` (OpenNext) + `graflet-backend`. D1: `graflet-catalog`.
All 5 backend secrets set via `wrangler secret put` (names in the memory file; **values not stored anywhere readable**).

## The ONE open item

`MARKETING_POSTAL_ADDRESS` in `apps/backend/wrangler.jsonc` is still
`REPLACE_WITH_POSTAL_ADDRESS`. It's a physical mailing address for the CAN-SPAM
footer on promo emails — real, human-supplied (PO box / business address ok).
Set it, then `wrangler deploy` from `apps/backend`. Not urgent: no emails send
until the catalog has docs and someone subscribes.

## The real next work (product, not config)

Email + downloads are **idle** and the catalog is **empty** for one reason:
`kg-pipeline/manifest.jsonl` is 1000× `status: pending` — **zero docs built**.
Until the pipeline produces `done` bundles, none of the wired features do
anything. So the meaningful next step is running the pipeline engine.

- Pipeline spec/tickets: `kg-pipeline/docs/spec.md` + `kg-pipeline/issues/` (frontier ≈ E2 — see memory `kg-pipeline-engine-spec-tickets`, `kg-pipeline-e0-seed-size-proxy`).
- Once docs are built: re-run `python3 apps/backend/scripts/seed_catalog.py`
  (paths already fixed for the ADR-0008 layout) → apply with
  `wrangler d1 execute graflet-catalog --file=apps/backend/catalog-seed.sql --remote`.
  The catalog table on the site then populates automatically (no web rebuild).

## Loose ends / follow-ups

- **`kg-pipeline` submodule** has the `docs-kg → graflet` rename in its working
  tree (6 files) sitting alongside your own uncommitted WIP (`bundles/`,
  `prompts/`, `HANDOFF.md`, `_run/watch_docs.py`). Left untouched. Commit + push
  it inside the submodule when ready, then bump the gitlink here.
- **`docs/vendor-ref/`** and the `kg-product-research` / `kg-data` submodules were
  deliberately **not** renamed (archival cross-refs would break / separate repos).
- This session's work is committed to a **branch** (not `main`) — merge when ready.

## Ops cheatsheet (gotchas that cost time)

- **Clean shell env is mandatory** for `node`/`pnpm`/`wrangler`: run everything
  as `env -i PATH="$PATH" HOME="$HOME" bash -c '…'` — the normal shell dies on
  `_nvm_load` FUNCNEST recursion. (See memory `backend-vitest-run-shell-recursion`.)
- Web deploy: `apps/web` → `opennextjs-cloudflare build && … deploy`. Build bakes
  `NEXT_PUBLIC_CATALOG_API_URL=https://api.graflet.rnui.dev`.
- Backend deploy: `apps/backend` → `wrangler deploy`.
- The wrangler OAuth token **cannot write DNS** and there is **no API to create
  GitHub OAuth Apps or PATs** — those were done via browser automation with the
  user clearing GitHub sudo-mode. Same wall applies to any future OAuth-app / PAT.
- `CATALOG_UPSERT_SECRET` (the pipeline needs it to push docs) was generated
  in-session and handed to the user — **retrieve from the password manager**, it
  is not stored in the repo or memory.

## Suggested skills for the next session

- **`/implement`** — to pick up the next `kg-pipeline` engine ticket and get docs
  building (the thing that unblocks catalog/email/downloads). Run it rooted in
  `kg-pipeline/` so it works on engine tickets only.
- **`graphify`** (or the `gfy` CLI) — for the actual KG-building step once the
  pipeline queue is running.
