## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Repository layout

Each dir is self-contained (own `package.json` + `node_modules`; no root workspace). See [ADR-0008].

| Path | What it is | Publish / deploy |
|---|---|---|
| `apps/web/` | Marketing + catalog **site** — Next.js on Cloudflare (OpenNext) | deployed via wrangler |
| `apps/backend/` | **API** — Cloudflare Worker (GitHub auth, catalog, KG broker) | deployed via wrangler |
| `packages/cli/` | The real **`graflet` CLI** (TypeScript) | → npm `@graflethq/cli` (when it ships) |
| `packages/graflet-npm/` | npm publish **stub** (name-lock placeholder) | → npm `@graflethq/cli` (current) |
| `packages/graflet-pypi/` | PyPI publish **stub** | → PyPI `graflet` |
| `kg-pipeline/` | KG build pipeline (submodule) | — |
| `assets/brand/` | Logo / banner / OG / favicons (public) | — |
| `.scratch/<feature>/` | Specs + issue tickets (see Issue tracker above) | local |
| `docs/adr/` | Architecture decision records | — |

**Where skill-work goes** (`/to-spec`, `/to-tickets`, `/implement`): CLI feature → `packages/cli/`;
site → `apps/web/`; API → `apps/backend/`. New specs/tickets → `.scratch/<feature>/`.

**Release:** bump the SAME version in BOTH `packages/graflet-npm/package.json` and
`packages/graflet-pypi/pyproject.toml`, then tag `vX.Y.Z` → CI publishes via OIDC. The two publish
stubs fold into `packages/cli` once the real CLI ships.

## Private submodules — research & data live outside this repo

This repo is public-facing. Two private submodules hold everything that must NOT be visible to anyone who clones it (both were purged from this repo's git history):

- **`kg-product-research/`** → private repo `mrpmohiburrahman/kg-product-research`. All product/market research notes (was `research/`). **All future research goes here** — write it under `kg-product-research/<topic>/`, never at the repo root.
- **`kg-data/`** → private repo `mrpmohiburrahman/kg-data` (Git LFS). Big DB blobs: `programming-docs.db` (read by `apps/backend/scripts/seed_catalog.py` + `kg-pipeline/build_manifest.py`), `context7.db`, `context7.sql.xz`. Never commit big binaries anywhere else.

Both are ordinary folders on disk — read/edit/write files in them freely. To make a change persist, commit **inside the submodule**, push it, then bump the gitlink here:

```
git -C kg-product-research add -A && git -C kg-product-research commit -m "…" && git -C kg-product-research push
git add kg-product-research && git commit -m "bump research"   # record new pointer in this repo
```

`kg-data/` uses LFS — run `git -C kg-data lfs pull` after a fresh clone to hydrate the blobs.
