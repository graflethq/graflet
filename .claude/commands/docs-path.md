---
description: Pin the documentation subtree (docs_path) for the next 10 docs in the kg-pipeline backfill queue, with a human approval gate.
---

# /docs-path — one batch of ten

Resumable. This file is the whole protocol: a fresh session with no memory of any previous one
runs it and continues exactly where the last batch stopped. Progress lives in
`kg-pipeline/docspath-queue.jsonl`, not in conversation history.

## Why this exists

A doc row with `docs_path IS NULL` makes `fetch._extract_subtree` sweep **every** `.md`/`.mdx`/
`.rst`/`.txt` in the repo, so its knowledge graph gets built from changelogs, test fixtures and
per-crate READMEs alongside the real documentation ([ADR-0011]). 106 already-shipped KGs were built
that way. `state._BUILDABLE` now refuses to claim a row with no `docs_path` at all, so **this command
is the only thing that puts work back into the build queue.**

`GraphScore is NOT the acceptance test for a pin` — ADR-0011 records react.dev falling 84.9 → 79.6 on
a *correct* narrowing, because the score rewards a wide sprawling graph. The acceptance test is a
human reading the subtree. Hence the gate at the bottom.

## Run it

All commands run from `kg-pipeline/`.

### 1. Where are we

```bash
cd /Users/mrp/Documents/1-Projects/graflet/kg-pipeline && python3 docspath.py status
```

If it prints `0 left`, phase 1 is finished — say so and stop. (Phase 2 = the ~856 never-built docs
with no `docs_path`; re-seed the queue for those only when the user asks.)

### 2. Get the batch

```bash
python3 docspath.py next -n 10
```

Read-only. Prints, per doc: the repo, the pinned SHA, the previous GraphScore, and a table of
candidate subtrees ranked by how many doc files each holds (noise dirs — `test`, `examples`,
`node_modules`, `.changeset`, … — already stripped).

The table has **two** count columns and they mean different things. **doc files** = the `.md`/`.mdx`/
`.rst`/`.txt` prose, i.e. is this documentation at all. **graphify ingests** = everything that
actually lands in the knowledge graph, because a pinned subtree is extracted *whole* and graphify
graphs code and config too. A candidate marked `⚠ code-heavy` has a build/config/source sidecar in
it (next.js's `packages` shows 47 doc files but ingests 3208) — either pick a narrower path or name
the sidecar in `docs_exclude`.

### 3. One subagent per doc

Spawn **10 subagents in a single message** so they run concurrently — one per doc. Give each one the
doc's whole section from step 2 verbatim, plus:

> You are pinning the documentation subtree for `<org>/<repo>` at commit `<sha>`.
> Inspect candidates with:
> `cd /Users/mrp/Documents/1-Projects/graflet/kg-pipeline && python3 docspath.py peek '<id>' '<candidate>'`
> (lists the actual doc FILE NAMES under a candidate, from a local cache — no API call, run it as
> often as you like). You may also `gh api repos/<org>/<repo>/readme --jq .download_url` or read the
> repo README to find where the project says its docs live.
>
> Pick the ONE subtree a reader of this project's documentation site would call "the docs". Rules:
> - Prefer the **narrowest** directory that still holds the real docs. `docs/en/docs` beats `docs`
>   for fastapi; `docs` beats `docs/01-app` for next.js. Filenames decide, not counts.
> - **Counts lie.** `packages` outranking `docs` means package READMEs, not documentation.
>   `docs/plans/…` means internal design notes. Peek before trusting the table.
> - A `⚠ code-heavy` candidate drags source into the graph — narrow the path, or `docs_exclude` the
>   sidecar (`.vitepress`, `snippets`, `scripts`, a nested `src`).
> - If the docs subtree also holds translations or versioned copies you do NOT want, name them in
>   `docs_exclude` (repo-relative prefixes, e.g. `src/content/docs/ja`).
> - If this repo has **no** documentation subtree — docs live in a different repo, or are AsciiDoc /
>   reStructuredText that isn't under one root, or the repo is a code-only SDK — return `no_docs`
>   with a one-line reason. When the docs live in another repo, say which one and end the reason with
>   `needs a repo repoint` so a later pass can find it.
>
> Return ONLY this JSON, nothing else:
> `{"id": "...", "docs_path": "...", "docs_exclude": [...], "note": "<why, one line>"}`
> or `{"id": "...", "no_docs": "<why, one line>"}`

### 4. Show the user, and WAIT

Collect the ten answers into one markdown table — rank, repo, chosen `docs_path`, doc-file count,
excludes, and the one-line why. Then **stop and ask for approval.** Do not run `apply` before the
user answers. They may correct any line; edit that line and re-show only if a correction lands.

### 5. Apply

Write the approved decisions to a JSON array and apply:

```bash
python3 docspath.py apply /tmp/batch.json --dry-run    # validates, writes nothing
python3 docspath.py apply /tmp/batch.json
```

`apply` refuses any pin that matches **zero** doc files at that SHA (the `pandas-dev/pandas` failure:
`doc/source` was pinned by hand, matched nothing, and the build machine only found out hours later).
On success it writes, in order: `docspath-queue.jsonl` → `manifest.jsonl` → the **live** VPS
`state.db`, where it also resets the row to `pending` and clears the old build's `engine`,
`graphscore`, `reason`, `retries` and `built_at`.

The running worker picks the re-queued docs up on its own. **No restart, no redeploy.** The rebuild
overwrites that doc's published bundle in place and re-POSTs its catalog row.

### 6. Report and hand back

Print `python3 docspath.py status` and tell the user to run `/docs-path` again for the next ten.

## Commit

`docspath-queue.jsonl` and `manifest.jsonl` are git-tracked in the **private** `kg-pipeline` repo.
Commit them there (never the public parent), then bump the gitlink in `graflet/`:

```bash
git -C kg-pipeline add manifest.jsonl docspath-queue.jsonl
git -C kg-pipeline commit -m "fix(manifest): pin docs_path for docs <a>–<b>"
git -C kg-pipeline push
git add kg-pipeline && git commit -m "bump kg-pipeline (docs_path batch)"
```

## If the worker is off

Check with `ssh ark-cluster.grid 'docker ps -a --filter name=free-worker --format "{{.Names}} {{.Status}}"'`.
Start it with `ssh ark-cluster.grid 'cd ~/selfhost/free-worker && docker compose start'`. Applying a
batch to a stopped worker is fine — the rows simply wait.

[ADR-0011]: ../docs/adr/0011-split-docs-and-library-repos.md
