---
description: Pin the documentation subtree (docs_path) for the next 10 docs in the kg-pipeline backfill queue, with a human approval gate.
argument-hint: "[deferred]"
---

# /docs-path — one batch of ten

**Arguments: `$ARGUMENTS`.** If that is `deferred` (or the user is clearly asking about the
set-aside pile), run the **Clearing the deferred pile** section at the bottom INSTEAD of the batch
protocol below. Empty argument = run the batch protocol.

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

## The version rule

Every row carries a `version_label` — `5.2`, `11.5.5`, `1.25`, or `latest` — and `next` prints it in
the doc's section header. **The pin must document that version.** A graph labelled 5.2 but built from
5.1 prose is wrong in a way no GraphScore catches and no reader of the bundle can see.

**Docs in the same repo.** The pinned SHA already freezes the version, so a single-version docs tree
needs no thought. The trap is a tree carrying several versions *side by side* — Docusaurus
`versioned_docs/version-X`, mkdocs `docs/v2` + `docs/v3`, a Mintlify `versions` array, a `legacy/`
sibling. Pin the copy matching `version_label` and `docs_exclude` the rest.

- `version_label` is a number → pin that number's copy. lightweight-charts 5.2 →
  `website/versioned_docs/version-5.2`, **not** `website/docs`, which is the unreleased `/next` mirror.
- `version_label` is `latest` → pin the current/live version and exclude every archived, `legacy/`
  or prior-major copy. Two API generations in one graph make every symbol lookup a coin flip:
  dnd-kit's `legacy/` and pandas-ai's `docs/v2` are each a *full parallel API reference* for a
  package the current version replaced, colliding on `useSortable`, `useDraggable`, `sensors`.
- The site config states the answer — Docusaurus `versions.json` + `lastVersion`, Mintlify
  `versions` in `docs.json`/`mint.json`, mkdocs `mike`. Read it instead of guessing from names.

**Docs in another repo** (`no_docs` + repoint). This is where version silently drifts, because the
docs repo's HEAD is whatever shipped last week. Never hand back a bare repo name — establish the ref
whose docs match `version_label`:

- prefer a tag or branch naming the version;
- no tags? anchor by DATE — get `version_label`'s release date from the CODE repo
  (`gh api repos/<org>/<repo>/releases`), then the last docs-repo commit at or before it
  (`gh api "repos/<o>/<r>/commits?until=<ISO>&per_page=1"`);
- a docs repo that pins the library it documents in its own `package.json` is a stronger signal
  than the date — use both when they agree.

Verify the ref exists. Do not invent a SHA. Write the reason so the later repoint pass needs no
rework:

```
docs live in <org>/<repo> at <ref> (<how the ref was matched>), subtree <path> — needs a repo repoint
```

Worked twice already: xyflow 11.5.5 → `xyflow/react-flow-docs@138e6e2` (HEAD is 11.9.2, four minors
off); adk-python 1.25 → `google/adk-docs@06a7859` (HEAD carries a whole `docs/2.0/` tree).

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

> You are pinning the documentation subtree for `<org>/<repo>` at commit `<sha>`, catalog version
> `<version_label>`.
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
> - **Match the catalog version.** If the repo holds several documentation versions side by side
>   (`versioned_docs/version-X`, `docs/v2` + `docs/v3`, a `legacy/` sibling, a Mintlify or Docusaurus
>   `versions` array), pin the one matching this row's version and `docs_exclude` the others. A
>   numeric version means that number's copy, not the unreleased `/next` mirror. `latest` means the
>   current/live version — exclude archived, `legacy/` and prior-major copies, because two API
>   generations in one graph make every symbol lookup a coin flip. Read the site config
>   (`versions.json`, `docs.json`, `mint.json`, `mkdocs.yml`) rather than guessing from directory
>   names, and say in your note which version the pin documents.
> - If this repo has **no** documentation subtree — docs live in a different repo, or are AsciiDoc /
>   reStructuredText that isn't under one root, or the repo is a code-only SDK — return `no_docs`
>   with a one-line reason.
> - When the docs live in **another repo**, you must also establish the ref in that repo whose docs
>   match THIS row's version — a tag naming the version, or (if the docs repo has no tags) the last
>   commit at or before this version's release date: `gh api repos/<org>/<repo>/releases` for the
>   date, then `gh api "repos/<o>/<r>/commits?until=<ISO>&per_page=1"`. A docs repo that pins the
>   library in its own `package.json` corroborates the date. **Never point at HEAD** — it is
>   whatever shipped last week, often a major version ahead. Verify the ref exists; do not invent a
>   SHA. Write the reason as:
>   `docs live in <org>/<repo> at <ref> (<how matched>), subtree <path> — needs a repo repoint`
> - If the **whole repo** is documentation and nothing else (a dedicated docs repo — laravel/docs is
>   103 markdown files at the root), return `repo_is_docs`. The existing repo-wide build is already
>   correctly scoped, so nothing is pinned and nothing is rebuilt. Never return `"docs_path": "."`
>   or `""` — an empty path reads as a pin but behaves as unpinned, and `apply` refuses it.
> - If the right subtree is **genuinely ambiguous** — two mutually exclusive candidates and no way to
>   have both — return `defer` with the ambiguity AND the options spelled out with their numbers. Do
>   not guess.
>
> Return ONLY this JSON, nothing else:
> `{"id": "...", "docs_path": "...", "docs_exclude": [...], "note": "<why, one line>"}`
> or `{"id": "...", "no_docs": "<why>"}` / `{"id": "...", "repo_is_docs": "<why>"}`
> / `{"id": "...", "defer": "<the ambiguity + the options>"}`

### 4. Show the user, and WAIT

Collect the ten answers into one markdown table — rank, repo, **catalog version**, chosen
`docs_path`, doc-file count, excludes, and the one-line why. Then **stop and ask for approval.** Do
not run `apply` before the user answers. They may correct any line; edit that line and re-show only
if a correction lands.

Before you show the table, write the decisions to the batch JSON and run the version check. It is
mechanical and catches what a subagent reading one repo cannot see — a version-looking directory
left INSIDE a pin is a second generation of the same docs in one graph:

```bash
python3 docspath.py versioncheck /tmp/batch.json   # this batch
python3 docspath.py versioncheck                   # no file: re-scan every pin already resolved
```

A hit is a bug unless the row's version IS that directory. Fix it one of two ways: add the sibling
to `docs_exclude`, or — if the row's version names the sibling — pin the sibling instead. Then
re-run until it prints `Every pin holds one version.` `apply --dry-run` runs the same check and
warns, so a mixed pin cannot reach the server unnoticed.

**A doubtful doc never holds up the other nine.** The user's standing rule (2026-07-31): pin what is
clear and push it to the server in this batch; `defer` anything genuinely ambiguous so they can
decide later. Do not ask them to resolve an ambiguity mid-batch and do not guess to keep the batch
whole. A deferred doc stays unpinned, so it cannot build, and `next` will not offer it again —
`docspath.py deferred` is the pile they come back to.

Distinguish two things before deferring. Ambiguity about **where the docs are** (two mutually
exclusive candidate subtrees) → defer. A known cost that **no choice of path removes** (duplicate
`.html`/`.md` twins, demo `.tsx` beside the prose) → pin it anyway and note the cost; deferring that
means the doc simply never gets built.

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

## Clearing the deferred pile

Run this instead of the batch protocol when the argument is `deferred`.

```bash
cd /Users/mrp/Documents/1-Projects/graflet/kg-pipeline && python3 docspath.py deferred
```

Each entry carries the ambiguity and the options already worked out, with counts — that analysis was
done when the doc was deferred and does not need redoing. Present them to the user as a short table
(option, what they get, what they lose, doc files / files ingested), **recommend one**, and wait.

The user answers in plain language ("take the API reference", "leave it alone", "just use the
guides"). Translate that into a decision and apply it — never make them write JSON:

```bash
python3 docspath.py apply /tmp/decision.json --dry-run && python3 docspath.py apply /tmp/decision.json
```

- a subtree → `{"id": "...", "docs_path": "...", "docs_exclude": [...], "note": "..."}`
- keep the existing build → `{"id": "...", "repo_is_docs": "<why the current scope is already right>"}`
- never build it → `{"id": "...", "no_docs": "<why>"}`

If the exclude list is long but mechanical (per-component `demo/`, `__tests__/` dirs — antd needs
~246 entries), GENERATE it from the cached tree rather than typing it; `docs_exclude` is prefix-only,
so a wildcard is not an option and a long literal list is the correct answer:

```python
import docspath as D
paths = D._tree(org, repo, sha)
exclude = [f"components/{c}/{s}" for c in comps for s in ("demo", "__tests__") if ...]
D._doc_count(paths, "components", exclude), D._graphable_count(paths, "components", exclude)
```

Applying a decision clears the `deferred` flag automatically (the row becomes `resolved`), so the
doc leaves the pile and — if it was pinned — re-enters the build queue at once.

## If the worker is off

Check with `ssh ark-cluster.grid 'docker ps -a --filter name=free-worker --format "{{.Names}} {{.Status}}"'`.
Start it with `ssh ark-cluster.grid 'cd ~/selfhost/free-worker && docker compose start'`. Applying a
batch to a stopped worker is fine — the rows simply wait.

[ADR-0011]: ../docs/adr/0011-split-docs-and-library-repos.md
