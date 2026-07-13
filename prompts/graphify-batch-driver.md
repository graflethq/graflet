# Graphify Batch Driver — context7-docs

Paste this whole file as a prompt into an interactive CommandCode session and let
it run. It walks the docs catalog on the external drive, builds a knowledge graph
for every version of every library with the **`/graphify`** slash command, scores
each graph, and writes everything **inside the doc folder**. It is **resumable** —
when you stop (or hit a context limit), paste it again and it continues where it
left off. Nothing is ever excluded; the source `.md` is never modified.

---

## Config (constants for this run)

- `MAP`   = `/Volumes/ExtSSD/context7-docs/.graphify-map.jsonl`
- `ROOT`  = `/Volumes/ExtSSD/context7-docs`
- `SCORE` = `~/.claude/skills/graphify-score/scripts`  (structure.py, sample.py, tally.py)
- `STOP_AT` = **~70%** of your context window. When you reach it, stop and report — do not push to the edge.

The `MAP` is already ordered **most-popular-first** (context7 `popularity_rank`; `next.js` → `better-auth` → `react` → `supabase` → …). Process it **top to bottom, in order**. Do not reorder.

Each map line looks like:
```
{"path": "vercel/next.js/default", "files": 442, "rank": 1}
```
`path` is `<owner>/<library>/<version>` relative to `ROOT`. `files` = markdown count (tells you if it is a giant). One line = one graph. `default` = the current/unversioned snapshot; treat it like any other version.

---

## What counts as "done" (the resume signal)

A unit is **done** when `ROOT/<path>/graphify-out/score.json` exists. That file is
written only by the final scoring step, and only after a *complete* graph — so its
presence means "graph built **and** scored." A giant that is only partly built has
**no** `score.json`, so it is correctly picked up again next run.

**At the start of every run**, build the skip-set once:
```bash
find /Volumes/ExtSSD/context7-docs -path '*/graphify-out/score.json' -print | \
  sed -E 's#^/Volumes/ExtSSD/context7-docs/(.*)/graphify-out/score.json$#\1#' | sort > /tmp/gfy_done.txt
TOTAL=$(wc -l < /Volumes/ExtSSD/context7-docs/.graphify-map.jsonl)   # 50803
DONE0=$(wc -l < /tmp/gfy_done.txt)                                    # already finished before this run
echo "start: $DONE0 / $TOTAL done"
```
While walking the `MAP`, skip any `path` present in `/tmp/gfy_done.txt`.

Hold three counters in mind for the whole run: `TOTAL` (fixed), `DONE0` (fixed,
from above), and `RUN_DONE` (starts at 0, +1 each time you write a unit's
`score.json`). Current overall done = `DONE0 + RUN_DONE`.

---

## The loop

Read `MAP` top to bottom. For each line whose `path` is **not** in the skip-set,
process it (below). After each unit, check your context usage. **When you reach
~70%, STOP** — print the run summary and tell the user to paste the prompt again.
Do not try to finish the whole catalog in one run; 50,803 units span many runs.

Process units **one at a time, in order.** Popular docs get mapped first.

---

## Progress heartbeat — print every ~60 seconds

You have no timer, so drive it off the wall clock. Record a baseline at run start:
```bash
LAST=$(date +%s)   # remember this value
```
Then, **after every unit and after every giant batch**, check the clock:
```bash
NOW=$(date +%s); echo "$(( NOW - LAST ))"
```
If the gap is **≥ 60**, print one progress line and reset `LAST=$NOW`:

```
[progress] 12,431 / 50,803 done (24.5%) · 38,372 left · this run: 87 · elapsed 63s since last
```

Compute it from your counters (no filesystem scan):
- `done  = DONE0 + RUN_DONE`
- `pct   = done * 100 / TOTAL`   (one decimal)
- `left  = TOTAL - done`

This guarantees an update at least once a minute during normal flow. A single
giant can run longer than a minute inside one `/graphify` pass — so also emit the
heartbeat **between its capped batches** (Step 1, giant case), not only between
units, so long giants still report every minute.

---

## Per-unit procedure

Let `SITE = ROOT/<path>` and `OUT = SITE/graphify-out`.

Always `cd "$SITE"` first, so `/graphify` writes `graphify-out/` **inside the doc
folder** (co-location) and never touches the source `.md`.

### Step 1 — Build the graph with `/graphify`

Run the **`/graphify`** slash command on `"$SITE"`. Do **not** pass `--out` — its
default puts `graphify-out/` inside `SITE`, which is exactly what we want.

`/graphify` does the heavy lifting with **its own worker subagents** — they read
the files and write results to disk; the merge is a script. **File contents never
enter your (main) context.** That is what keeps this session lean across thousands
of units. Let it work; hold only its short receipts.

**Two cases:**

- **Normal unit** (`files` ≤ 500 and `/graphify` shows no size warning): let
  `/graphify` run to completion normally. It dispatches `ceil(files/22)` worker
  subagents (1–23 of them), merges, and writes `graphify-out/graph.json`.

- **Giant unit** (`files` > 500, or `/graphify` prints its
  *"Semantic extraction will be expensive … Consider running on a subfolder"*
  warning and asks which subfolder to narrow to):
  - **Do NOT narrow, do NOT exclude anything.** We map the whole folder. If it
    asks you to pick a subfolder, decline and proceed on the full folder.
  - **Override `/graphify`'s "dispatch all chunks in one message" rule.** Firing
    hundreds/thousands of subagents at once would blow your context. Instead,
    dispatch worker subagents in **capped batches of ~16 chunks** (~350 files).
    After each batch, run `/graphify`'s cache-merge steps so the batch is saved,
    then start the next batch. graphify's semantic **cache** means already-done
    files are skipped on the next batch and on the next run.
  - **After each capped batch, run the heartbeat check** (≥60s → print progress) so
    a long giant still reports every minute.
  - **If you approach ~70% context before the giant is fully built: STOP.** The
    cache preserves every finished file. Do **not** score it, do **not** treat it
    as done. Next run, `/graphify` resumes from the cache and finishes the rest.

### Step 2 — Confirm the graph is complete

The unit is only ready to score when the graph covers **all** files:
```bash
test -f "$OUT/graph.json" && \
  { test ! -f "$OUT/.graphify_uncached.txt" || ! test -s "$OUT/.graphify_uncached.txt"; } && \
  echo COMPLETE || echo PARTIAL
```
- `PARTIAL` (a giant still building) → **skip scoring, do not mark done, move on.**
- `COMPLETE` → go to Step 3.

### Step 3 — Score the graph (baked in — do NOT call the graphify-score skill)

We use only the score **scripts** plus one judge subagent. No HTML/MD report, no
extras.

**3a. Tidy (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/structure.py "$OUT"
```
Writes `OUT/.graphify_score/tidy.json`. Call `WORK = OUT/.graphify_score`.

**3b. Worksheets (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/sample.py "$OUT" --n-edges 40 --n-files 8
```
Writes `WORK/faithfulness_worksheet.json` and `WORK/coverage_worksheet.json`.
(For a tiny graph the scripts sample fewer automatically.)

**3c. Judge — dispatch ONE `general-purpose` subagent** (this keeps the edge/file
text out of your context). Give it the two worksheet paths and this exact task:

> You are grading a knowledge graph. Two input files:
>
> **A) `<WORK>/faithfulness_worksheet.json`** — has an `edges` list; each edge has
> `idx`, `source`, `relation`, `target`, and `evidence` (the source text where the
> graph claims it found this). For **each** edge decide if the evidence supports
> `source —relation→ target`:
> - `supported` — evidence states or reasonably implies it (paraphrase/inference ok).
> - `unsupported` — evidence is present but does not support it, contradicts it, or the claim is nonsensical (a made-up line).
> - `unclear` — genuinely can't tell (evidence empty and labels don't settle it). Do not punish merely-missing evidence.
> Scrutinize `INFERRED`/`AMBIGUOUS` lines hardest. Write `<WORK>/faithfulness_verdicts.json`:
> `{"verdicts":[{"idx":0,"verdict":"supported"},{"idx":2,"verdict":"unsupported","why":"short reason"}]}`
> — one entry per edge; `why` only for unsupported.
>
> **B) `<WORK>/coverage_worksheet.json`** — has a `files` list; each has `file`,
> `text`, `nodes_in_graph`, `edges_in_graph`. For **each** file: read `text`, list
> the **3–6 most important facts/entities** it should contribute, and for each check
> if it appears in `nodes_in_graph`/`edges_in_graph` (judge meaning, not exact
> strings; ignore boilerplate/imports). Write `<WORK>/coverage_verdicts.json`:
> `{"files":[{"file":"api.md","facts":[{"fact":"configurable timeouts","present":true},{"fact":"retry/backoff","present":false}]}]}`
>
> Write both files to disk. Return only a one-line receipt: counts of
> supported/unsupported/unclear and covered/missed facts. Do not paste the JSON.

**3d. Tally (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/tally.py "$OUT" --judge-model "<your model name, e.g. Claude Opus 4.8>"
```
(If you don't know your model string, omit `--judge-model`.) This blends
Truthful/Complete/Tidy, prints the **GraphScore** headline, and writes
`OUT/score.json` (+ `OUT/SCORE_REPORT.md`). Writing `score.json` = this unit is
now **done**.

### Step 4 — Count it, log one line, heartbeat, continue

- **Increment `RUN_DONE` by 1** (this unit's `score.json` now exists).
- Append one line to your running summary, e.g.:
  ```
  rank 1  vercel/next.js/default  →  GraphScore 92  (T 100 / C 90 / Ti 88)  1772 nodes, 2148 edges
  ```
- **Run the heartbeat check** (≥60s since `LAST` → print the `[progress]` line, reset `LAST`).
- Move to the next map line.

---

## Stopping and resuming

When you hit ~70% context (or the user interrupts), **stop cleanly** and print:

```
Run summary
  processed this run : N units
  giants advanced    : M (partial, will resume)
  total done overall : <count from /tmp/gfy_done.txt + this run>
  next up            : <path of the first not-yet-done map line>
To continue: paste prompts/graphify-batch-driver.md again.
```

Re-pasting resumes automatically: the `score.json` skip-set skips finished units,
and graphify's cache continues any partial giant.

---

## Guardrails (do not violate)

- **Never modify the source `.md`.** Only ever write under `graphify-out/`.
- **Never exclude or narrow** a folder's content — map every unit whole (giants just take several runs).
- **Never pass `--out`** — graphify-out must stay inside the doc folder.
- **Never dispatch more than ~16 worker subagents at once** — batch giants; that ceiling is what protects your context.
- **Keep file/edge text in subagents, not in your context** — you hold only receipts, headlines, and the map. That is the whole point.
- **Process in map order** (popularity). Do not skip ahead except to skip already-`done` units.
- **Emit the progress heartbeat at least once a minute** — `done / total (pct) · left` — from the counters, between units and between giant batches.
