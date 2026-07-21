## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Private submodules — research & data live outside this repo

This repo is public-facing. Two private submodules hold everything that must NOT be visible to anyone who clones it (both were purged from this repo's git history):

- **`kg-product-research/`** → private repo `mrpmohiburrahman/kg-product-research`. All product/market research notes (was `research/`). **All future research goes here** — write it under `kg-product-research/<topic>/`, never at the repo root.
- **`kg-data/`** → private repo `mrpmohiburrahman/kg-data` (Git LFS). Big DB blobs: `programming-docs.db` (read by `backend/scripts/seed_catalog.py` + `kg-pipeline/build_manifest.py`), `context7.db`, `context7.sql.xz`. Never commit big binaries anywhere else.

Both are ordinary folders on disk — read/edit/write files in them freely. To make a change persist, commit **inside the submodule**, push it, then bump the gitlink here:

```
git -C kg-product-research add -A && git -C kg-product-research commit -m "…" && git -C kg-product-research push
git add kg-product-research && git commit -m "bump research"   # record new pointer in this repo
```

`kg-data/` uses LFS — run `git -C kg-data lfs pull` after a fresh clone to hydrate the blobs.
