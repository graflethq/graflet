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

A unit is **done** when `ROOT/<path>/graphify-out/.graphify_batch_done` exists. That
marker is the **last** action of the savings step (Step 4) — written only after the
graph is built, scored, **and** the savings block is merged. A giant that is only
partly built, or a unit that scored but died before savings, has **no** marker, so it
is correctly picked up again next run.

**At the start of every run**, set counters and a unique session id:
```bash
ROOT=/Volumes/ExtSSD/context7-docs
CLAIM=/Users/mrp/Documents/1-Projects/graphify-graph/prompts/lib/graphify-claim.py
LOG="$ROOT/.graphify-progress.log"    # shared GLOBAL counter — one line per completed unit, all sessions
TOTAL=$(wc -l < "$ROOT/.graphify-map.jsonl")                                        # 50803
# seed the shared counter once (first session), from any already-finished markers
if [ ! -f "$LOG" ]; then
  find "$ROOT" -path '*/graphify-out/.graphify_batch_done' 2>/dev/null | \
    sed -E "s#^$ROOT/(.*)/graphify-out/.graphify_batch_done\$#\1#" > "$LOG.seed.$$"
  mv -n "$LOG.seed.$$" "$LOG" 2>/dev/null; rm -f "$LOG.seed.$$"
fi
DONE0=$(wc -l < "$LOG" | tr -d ' ')    # GLOBAL done at session start (across every session)
SESSION="$(hostname -s)-$$-$RANDOM"    # unique to THIS session; owns/releases its claims
LAST=$(date +%s)
echo "session $SESSION · start: $DONE0 / $TOTAL done"
```
Unit selection is **not** a plain map-walk — it goes through the claim helper (see
**Parallel-safe claims** below) so many sessions run at once without collisions. The
processed count is **global** across all sessions: `wc -l "$LOG"`.

Hold three counters for the whole run: `TOTAL` (fixed), `DONE0` (fixed), and
`RUN_DONE` (starts at 0, +1 each time a unit's `.graphify_batch_done` marker is
written by Step 4). Current overall done = `DONE0 + RUN_DONE`.

---

## Parallel-safe claims (many sessions at once)

Multiple sessions — CommandCode.ai and/or Hermes, all on this same Mac — can run this
prompt at the same time against the same drive. To stop two sessions grabbing the
same unit, each unit is **claimed** through a tiny atomic helper before you touch it:

- **Get your next unit** (the most-popular unclaimed + undone unit, atomically claimed
  for you):
  ```bash
  UNIT=$(python3 "$CLAIM" next "$ROOT" "$ROOT/.graphify-map.jsonl" "$SESSION")
  ```
  Empty → nothing left to claim (all done, or everything in flight in other sessions) → stop.
- **Refresh** your claim while working (piggyback the heartbeat):
  `python3 "$CLAIM" refresh "$ROOT" "$UNIT" "$SESSION"`.
- **Release** it the moment it is done; **release-all** on stop.

Claims live in `ROOT/.graphify-claims/` (atomic `mkdir`). A claim older than 15 min
(a crashed session) is auto-stealable, so no unit is stranded. Popularity order holds:
with N sessions the top N popular units are worked at once, then the next N.

## The loop

Repeat until `next` returns empty or you hit ~70% context:

1. **Claim the next unit and announce it:**
   ```bash
   UNIT=$(python3 "$CLAIM" next "$ROOT" "$ROOT/.graphify-map.jsonl" "$SESSION")
   [ -z "$UNIT" ] && echo "nothing left to claim — stopping" && exit 0
   D=$(wc -l < "$LOG" | tr -d ' '); P=$(awk "BEGIN{printf \"%.1f\",$D*100/$TOTAL}")
   printf '\n▶ CLAIMED  %s\n   %s\n   processed so far: %s / %s (%s%%)\n' "$UNIT" "$ROOT/$UNIT" "$D" "$TOTAL" "$P"
   ```
2. `SITE="$ROOT/$UNIT"`; process it with the **per-unit procedure** below. It is already claimed for you.
3. Once it is **done** (marker written by Step 4), **record it in the global counter,
   announce completion, and release the claim:**
   ```bash
   echo "$UNIT" >> "$LOG"                         # atomic append — global count ticks up by one
   RUN_DONE=$((RUN_DONE+1))
   D=$(wc -l < "$LOG" | tr -d ' '); P=$(awk "BEGIN{printf \"%.1f\",$D*100/$TOTAL}")
   printf '\n✓ DONE  %s   GraphScore <NN from Step 3>\n   %s\n   processed so far: %s / %s (%s%%)\n' "$UNIT" "$ROOT/$UNIT" "$D" "$TOTAL" "$P"
   python3 "$CLAIM" release "$ROOT" "$UNIT" "$SESSION"
   ```
   (Substitute the GraphScore the tally step printed.) The two savings lines the
   helper printed in Step 4 appear just below this.
4. Heartbeat check (and `refresh` your claim if still mid-unit).

Process **one unit at a time**. **When you reach ~70% context, STOP:** release
everything you still hold — `python3 "$CLAIM" release-all "$ROOT" "$SESSION"` — then
print the run summary and tell the user to paste the prompt again. 50,803 units span
many runs; a partial giant you release resumes from its cache in the next session.

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

Compute `done` from the shared counter (one small file — reflects **every** session),
and `this run` from your own tally:
- `done  = $(wc -l < "$LOG")`   (global, all sessions)
- `pct   = done * 100 / TOTAL`   (one decimal)
- `left  = TOTAL - done`
- `this run: RUN_DONE`   (your session's completions)

**Every heartbeat, also refresh your current claim** so a long/giant unit never looks
abandoned to other sessions:
```bash
python3 "$CLAIM" refresh "$ROOT" "$UNIT" "$SESSION"
```

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
`OUT/score.json` (+ `OUT/SCORE_REPORT.md`). Not done yet — Step 4 (savings)
finalizes the unit and writes the done marker.

### Step 4 — Savings + mark done (baked telemetry)

Run the shared savings helper. It counts tokens with the **free** `count_tokens`
API, prices them at Sonnet 5 (both tiers), estimates local ollama time from the
benchmark rate, merges a `savings` block into `score.json`, appends a Savings
section to `SCORE_REPORT.md`, prints two per-site lines, and — as its **last**
action — writes `graphify-out/.graphify_batch_done` (the done marker):
```bash
python3 /Users/mrp/Documents/1-Projects/graphify-graph/prompts/lib/graphify-savings.py "$SITE" "$OUT"
```
This is the free token counter only — no generation, no cost. It needs
`ANTHROPIC_API_KEY` in the environment; if absent it falls back to a word-based
token estimate and says so in the JSON (still writes the marker). Only run it on a
**COMPLETE** unit (Step 2) — never on a partial giant.

### Step 5 — Back to the loop (counter, announce, release, heartbeat)

The unit is finished. Control returns to **The loop**, step 3, which does it all:
appends to the global counter (`RUN_DONE++`), prints the `✓ DONE` announcement (site +
absolute path + `processed so far: done / total (pct)`), and releases the claim. The
two savings lines from Step 4 print just under it. Then run the heartbeat check and
claim the next unit.

---

## Stopping and resuming

When you hit ~70% context (or the user interrupts), **stop cleanly**. First **release
every claim you still hold** so other sessions can pick up your in-flight work
(especially a partial giant):
```bash
python3 "$CLAIM" release-all "$ROOT" "$SESSION"
```
Then print:

```
Run summary
  session            : $SESSION
  processed this run : N units
  giants advanced    : M (partial, released for another session to resume)
  total done overall : DONE0 + RUN_DONE
  claims released    : <from release-all>
To continue: paste prompts/graphify-batch-driver.md again (any number of sessions in parallel).
```

Re-pasting (or launching more sessions) resumes automatically: `next` skips finished
(marker) and claimed units, and graphify's cache continues any partial giant.

---

## Guardrails (do not violate)

- **Never modify the source `.md`.** Only ever write under `graphify-out/`.
- **Never exclude or narrow** a folder's content — map every unit whole (giants just take several runs).
- **Never pass `--out`** — graphify-out must stay inside the doc folder.
- **Never dispatch more than ~16 worker subagents at once** — batch giants; that ceiling is what protects your context.
- **Keep file/edge text in subagents, not in your context** — you hold only receipts, headlines, and the map. That is the whole point.
- **Take work only via the claim helper's `next`** — never hand-pick a unit or walk the map yourself. That is what keeps parallel sessions collision-free.
- **Refresh your claim every heartbeat; release on done; release-all on stop.** A unit you never release (short of a crash) blocks it from other sessions for 15 min.
- **Emit the progress heartbeat at least once a minute** — `done / total (pct) · left` — from the counters, between units and between giant batches.
- **Mark a unit done only via the savings helper (Step 4)** — it writes `.graphify_batch_done` last, after the graph, the score, and the savings block. Never `touch` the marker yourself.
- **The `count_tokens` API is free** — it never generates. Do not skip savings to "save cost"; there is none.
