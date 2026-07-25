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
| `packages/cli/` | The real **`graflet` CLI** (TypeScript) | → npm `@graflethq/cli` — **live, 0.3.0** |
| `packages/graflet-npm/` | Retired name-lock stub — not published, not bumped | — |
| `packages/graflet-pypi/` | PyPI **launcher** (shells out to the npm CLI) | → PyPI `graflet` — live, 0.3.0 |
| `kg-pipeline/` | KG build pipeline (submodule) | — |
| `assets/brand/` | Logo / banner / OG / favicons (public) | — |
| `.scratch/<feature>/` | Specs + issue tickets (see Issue tracker above) | local |
| `docs/adr/` | Architecture decision records | — |

**Where skill-work goes** (`/to-spec`, `/to-tickets`, `/implement`): CLI feature → `packages/cli/`;
site → `apps/web/`; API → `apps/backend/`. New specs/tickets → `.scratch/<feature>/`.

**Release:** bump the SAME version in **three** places — `packages/cli/package.json`,
`packages/graflet-pypi/pyproject.toml` AND `packages/graflet-pypi/src/graflet/__init__.py`
(`__version__`) — then tag `vX.Y.Z` → `.github/workflows/publish.yml` publishes both via OIDC.
`packages/graflet-npm/` is the retired name-lock stub; it is NOT published and is not bumped.

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

<!-- CCX-DELEGATE:BEGIN (delete this block to disable soft delegation) -->
## Delegate cheap subtasks to CommandCode (`ccd`)

`.commandcode-delegate/ccd "<task>"` runs a task on a cheap model on a separate
credit pool; only the short answer returns here. Saves Opus tokens.

A hook blocks whole-file reads over 96 KB — both `Read` and `cat` — and hands you
the exact `ccd` line to run, so big reads are enforced, not remembered. Reach for
`ccd` yourself for what no hook can see before it runs: broad multi-file searches
and generating repetitive files (`-w` to let it write).

Each call is a fresh session with no memory of this chat — put ALL context in the
task string and ask for a SHORT result. Do it inline instead when the task is
small, you need exact bytes to edit, or `ccd` prints `CCX_FALLBACK`.

`ccd -h` prints flags; `.commandcode-delegate/README.md` is the full doc.
<!-- CCX-DELEGATE:END -->

<!-- CCX-SKILLS:BEGIN (one-line pointer; delete to stop routing skills through CommandCode) -->
> **`research` / `handoff` in this repo:** do the agent work with parallel
> `.commandcode-delegate/ccd -s <skill> "<sub-topic>"` calls, NOT Claude Code
> `Agent()` subagents — `-s` loads the same skill file the subagent would have read.
> You synthesise the replies. Details: `.commandcode-delegate/SKILL-ROUTING.md`.
<!-- CCX-SKILLS:END -->
