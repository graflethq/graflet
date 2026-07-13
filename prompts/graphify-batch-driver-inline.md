# Graphify Batch Driver — context7-docs — INLINE (CommandCode.ai, no subagents)

Paste this whole file as a prompt into an interactive **CommandCode.ai** session.
It is the twin of `graphify-batch-driver.md`, for a runner that **cannot dispatch
subagents** — so every step runs **inline in this one session**. It walks the docs
catalog on the external drive, builds a knowledge graph for every version of every
library with **`/graphify`**, scores each graph, records the cost/time savings, and
writes everything **inside the doc folder**. It is **resumable**. Nothing is ever
excluded; the source `.md` is never modified.

> **The one hard difference from the twin prompt:** no Agent tool, no worker
> subagents, no scoring subagent. You (this session) do the reading, extraction,
> and judging yourself, in batches. That fills your context faster, so you will hit
> the ~70% stop sooner and need more re-runs. The cache makes every stop resumable.

---

## Config (constants for this run)

- `MAP`   = `/Volumes/ExtSSD/context7-docs/.graphify-map.jsonl`
- `ROOT`  = `/Volumes/ExtSSD/context7-docs`
- `SCORE` = `~/.claude/skills/graphify-score/scripts`  (structure.py, sample.py, tally.py)
- `SAVINGS` = `/Users/mrp/Documents/1-Projects/graphify-graph/prompts/lib/graphify-savings.py`
- `SPEC`  = `~/.claude/skills/graphify/references/extraction-spec.md`  (the chunk JSON schema / node-ID rules)
- `STOP_AT` = **~70%** of your context window. When you reach it, stop and report.

The `MAP` is ordered **most-popular-first** (context7 `popularity_rank`; `next.js` →
`better-auth` → `react` → `supabase` → …). Process it **top to bottom, in order**.

Each map line:
```
{"path": "vercel/next.js/default", "files": 442, "rank": 1}
```
`path` = `<owner>/<library>/<version>` relative to `ROOT`. One line = one graph.
`default` = current snapshot; treat it like any version.

---

## What counts as "done" (the resume signal)

A unit is **done** when `ROOT/<path>/graphify-out/.graphify_batch_done` exists — the
last action of Step 5 (savings), written only after graph + score + savings are all
complete. A partial giant has no marker and is picked up again next run.

**At the start of every run**, set counters and a unique session id:
```bash
ROOT=/Volumes/ExtSSD/context7-docs
CLAIM=/Users/mrp/Documents/1-Projects/graphify-graph/prompts/lib/graphify-claim.py
LOG="$ROOT/.graphify-progress.log"    # shared GLOBAL counter — one line per completed unit, all sessions
TOTAL=$(wc -l < "$ROOT/.graphify-map.jsonl")                                        # 50803
if [ ! -f "$LOG" ]; then              # seed once (first session) from any finished markers
  find "$ROOT" -path '*/graphify-out/.graphify_batch_done' 2>/dev/null | \
    sed -E "s#^$ROOT/(.*)/graphify-out/.graphify_batch_done\$#\1#" > "$LOG.seed.$$"
  mv -n "$LOG.seed.$$" "$LOG" 2>/dev/null; rm -f "$LOG.seed.$$"
fi
DONE0=$(wc -l < "$LOG" | tr -d ' ')    # GLOBAL done at session start
SESSION="$(hostname -s)-$$-$RANDOM"    # unique to THIS session; owns/releases its claims
LAST=$(date +%s)
echo "session $SESSION · start: $DONE0 / $TOTAL done"
```
Unit selection goes through the **claim helper** (see Parallel-safe claims below), so
many sessions run at once without collisions. The processed count is **global** across
all sessions (`wc -l "$LOG"`); `RUN_DONE` (0, +1 per completion) is just this session's.

---

## Progress heartbeat — print every ~60 seconds

No timer — drive off the wall clock. After every unit **and after every inline
batch**, run:
```bash
NOW=$(date +%s); echo "$(( NOW - LAST ))"
```
If ≥ 60, print one line and reset `LAST=$NOW`:
```
[progress] 12,431 / 50,803 done (24.5%) · 38,372 left · this run: 87
```
with `done` from the shared counter (global, all sessions): `done = $(wc -l < "$LOG")`,
`pct = done*100/TOTAL`, `left = TOTAL - done`, plus `this run: RUN_DONE`. No cumulative
cost total — per-site only (Step 5).

**Every heartbeat, also refresh your claim** so a long/giant unit is never seen as
abandoned: `python3 "$CLAIM" refresh "$ROOT" "$UNIT" "$SESSION"`.

---

## Parallel-safe claims (many sessions at once)

Multiple sessions — CommandCode.ai and/or Hermes, all on this same Mac — can run this
prompt at once against the same drive. Each unit is **claimed** atomically before you
touch it, so no two sessions collide:

- **Next unit** (most-popular unclaimed + undone, claimed for you):
  ```bash
  UNIT=$(python3 "$CLAIM" next "$ROOT" "$ROOT/.graphify-map.jsonl" "$SESSION")
  ```
  Empty → nothing left to claim → stop.
- **Refresh** while working: `python3 "$CLAIM" refresh "$ROOT" "$UNIT" "$SESSION"` (piggyback the heartbeat).
- **Release** on done; **release-all** on stop.

Claims live in `ROOT/.graphify-claims/` (atomic `mkdir`). A claim older than 15 min
(crashed session) is auto-stealable. Popularity order holds: with N sessions the top N
popular units are worked at once, then the next N.

## The loop

Repeat until `next` returns empty or you hit ~70% context:

1. **Claim the next unit and announce it:**
   ```bash
   UNIT=$(python3 "$CLAIM" next "$ROOT" "$ROOT/.graphify-map.jsonl" "$SESSION")
   [ -z "$UNIT" ] && echo "nothing left to claim — stopping" && exit 0
   D=$(wc -l < "$LOG" | tr -d ' '); P=$(awk "BEGIN{printf \"%.1f\",$D*100/$TOTAL}")
   printf '\n▶ CLAIMED  %s\n   %s\n   processed so far: %s / %s (%s%%)\n' "$UNIT" "$ROOT/$UNIT" "$D" "$TOTAL" "$P"
   ```
2. `SITE="$ROOT/$UNIT"`; process it (per-unit procedure below). It is already claimed for you.
3. Once **done** (marker from Step 5), **record it, announce, release:**
   ```bash
   echo "$UNIT" >> "$LOG"                         # atomic append — global count +1
   RUN_DONE=$((RUN_DONE+1))
   D=$(wc -l < "$LOG" | tr -d ' '); P=$(awk "BEGIN{printf \"%.1f\",$D*100/$TOTAL}")
   printf '\n✓ DONE  %s   GraphScore <NN from Step 3>\n   %s\n   processed so far: %s / %s (%s%%)\n' "$UNIT" "$ROOT/$UNIT" "$D" "$TOTAL" "$P"
   python3 "$CLAIM" release "$ROOT" "$UNIT" "$SESSION"
   ```
   (Substitute the GraphScore from tally; the two savings lines from Step 5 print below it.)
4. Heartbeat check (and `refresh` your claim if still mid-unit).

Process **one unit at a time**. **At ~70% context, STOP:** release everything —
`python3 "$CLAIM" release-all "$ROOT" "$SESSION"` — print the run summary, tell the
user to paste again. Inline runs cover fewer units each than the subagent twin; a
partial giant you release resumes from cache in the next session.

---

## Per-unit procedure

`SITE = ROOT/<path>`, `OUT = SITE/graphify-out`. Always `cd "$SITE"` first so
`graphify-out/` lands **inside** the doc folder and the source `.md` is untouched.

### Step 1 — Build the graph with `/graphify`, fully inline

Invoke **`/graphify`** on `"$SITE"`, with **three overrides you must enforce**:

1. **NO subagents / NO Agent tool.** `/graphify`'s Part B says "you MUST use the
   Agent tool" — **ignore that here.** You cannot dispatch subagents. Instead **you**
   are the extractor: work through the files in **small inline batches** (Step 1a).
2. **NO other backend.** Do not let graphify reach for Gemini/OpenAI/Mistral/ollama
   or any API key for extraction. **This session is the model.** If a
   `GEMINI_API_KEY`/`GOOGLE_API_KEY`/etc. is set in the environment, do not use it —
   the semantic extraction is your own inline reasoning, exactly as `/graphify`'s
   host-model path intends.
3. **NO `--out`, NO narrowing, NO exclusion** — map the whole folder; `graphify-out/`
   stays inside `SITE`.

**Step 1a — inline extraction loop** (this replaces `/graphify`'s subagent dispatch):
- Run `/graphify`'s **detect** and **cache-check** steps normally (they are plain
  scripts — no subagents) to get the list of *uncached* files.
- Read `SPEC` once so you produce the exact chunk JSON graphify expects.
- Then loop: take the next **~15–20 uncached files**, read them, extract the nodes
  and edges **inline yourself**, and write the result to
  `graphify-out/.graphify_chunk_NN.json` (per `SPEC`). Do **not** dispatch an agent —
  you write the chunk file directly.
- **After each batch: run the heartbeat check**, then check context. Keep going while
  under ~70%.
- When all uncached files are done, run `/graphify`'s **merge + build** steps (plain
  scripts) to produce `graphify-out/graph.json`.

**Giant units** (`files` > 500, or graphify warns the corpus is expensive): same loop,
just more batches. **If you approach ~70% before the giant is fully extracted: STOP.**
The cache preserves every finished batch; the unit is **not** done (no marker). Next
run resumes from the cache.

### Step 2 — Confirm the graph is complete

```bash
test -f "$OUT/graph.json" && \
  { test ! -f "$OUT/.graphify_uncached.txt" || ! test -s "$OUT/.graphify_uncached.txt"; } && \
  echo COMPLETE || echo PARTIAL
```
`PARTIAL` (giant still building) → skip scoring, do not mark done, move on.
`COMPLETE` → Step 3.

### Step 3 — Score the graph (baked, inline — do NOT call the graphify-score skill)

**3a. Tidy (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/structure.py "$OUT"
```
Writes `OUT/.graphify_score/tidy.json`. `WORK = OUT/.graphify_score`.

**3b. Worksheets (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/sample.py "$OUT" --n-edges 40 --n-files 8
```
Writes `WORK/faithfulness_worksheet.json` and `WORK/coverage_worksheet.json`.

**3c. Judge — INLINE (no subagent).** Read the two worksheets yourself and write the
two verdict files:

- **Truthful** — from `WORK/faithfulness_worksheet.json` (`edges` list, each with
  `idx`, `source`, `relation`, `target`, `evidence`). For each edge:
  `supported` (evidence states/implies it), `unsupported` (present but doesn't support
  / contradicts / nonsensical — a made-up line), or `unclear` (genuinely can't tell;
  don't punish merely-missing evidence). Scrutinize `INFERRED`/`AMBIGUOUS` hardest.
  Write `WORK/faithfulness_verdicts.json`:
  `{"verdicts":[{"idx":0,"verdict":"supported"},{"idx":2,"verdict":"unsupported","why":"short reason"}]}`
  — one per edge; `why` only for unsupported.
- **Complete** — from `WORK/coverage_worksheet.json` (`files` list, each with `file`,
  `text`, `nodes_in_graph`, `edges_in_graph`). For each file: read `text`, list the
  **3–6 most important facts/entities**, check if each appears in the graph (judge
  meaning, not strings; ignore boilerplate/imports). Write `WORK/coverage_verdicts.json`:
  `{"files":[{"file":"api.md","facts":[{"fact":"configurable timeouts","present":true},{"fact":"retry/backoff","present":false}]}]}`

**3d. Tally (script):**
```bash
python3 ~/.claude/skills/graphify-score/scripts/tally.py "$OUT" --judge-model "<your model name>"
```
(Omit `--judge-model` if unknown.) Writes `OUT/score.json` + `OUT/SCORE_REPORT.md`.
Not done yet — Step 5 finalizes.

### Step 4 — (there is no separate subagent step; scoring above was inline)

### Step 5 — Savings + mark done

```bash
python3 /Users/mrp/Documents/1-Projects/graphify-graph/prompts/lib/graphify-savings.py "$SITE" "$OUT"
```
It counts tokens with the **free** `count_tokens` API, prices at Sonnet 5 (both
tiers), estimates local ollama time from the benchmark rate, merges a `savings`
block into `score.json`, appends a Savings section to `SCORE_REPORT.md`, prints two
per-site lines, and writes `graphify-out/.graphify_batch_done` **last** (the done
marker). Free — no generation, no cost. Needs `ANTHROPIC_API_KEY`; without it, it
falls back to a word-based token estimate and still writes the marker. Run **only on
a COMPLETE unit**.

> This is the **only** place ollama/qwen is relevant, and even here it does **not
> run** — the local-time number is computed from the pre-measured benchmark rate
> inside the helper. No local model is ever invoked during the batch.

### Step 6 — Back to the loop (counter, announce, release, heartbeat)

The unit is finished. Control returns to **The loop**, step 3: append to the global
counter (`RUN_DONE++`), print the `✓ DONE` announcement (site + absolute path +
`processed so far: done / total (pct)`), release the claim (the Step 5 savings lines
print under it). Then heartbeat check and claim the next unit.

---

## Stopping and resuming

At ~70% context (or on interrupt), stop cleanly. First **release every claim you
hold** — `python3 "$CLAIM" release-all "$ROOT" "$SESSION"` — so other sessions can
resume your in-flight work, then print:
```
Run summary
  session            : $SESSION
  processed this run : N units
  giants advanced    : M (partial, released for another session)
  total done overall : <DONE0 + RUN_DONE>
To continue: paste prompts/graphify-batch-driver-inline.md again (any number of sessions in parallel).
```
Re-pasting (or launching more sessions) resumes automatically: `next` skips finished
and claimed units; graphify's cache continues any partial giant.

---

## Guardrails (do not violate)

- **No subagents, no Agent tool** — everything inline. That is the whole reason this prompt exists.
- **No other backend for extraction** — this session is the model; ignore Gemini/OpenAI/Mistral/ollama keys for graphing.
- **Never modify the source `.md`** — only write under `graphify-out/`.
- **Never exclude or narrow** — map every unit whole (giants take several runs).
- **Never pass `--out`** — graphify-out stays inside the doc folder.
- **Take work only via the claim helper's `next`** — never hand-pick a unit or walk the map yourself. That is what keeps parallel sessions collision-free.
- **Refresh your claim every heartbeat; release on done; release-all on stop.**
- **Emit the heartbeat at least once a minute** — between units and between inline batches.
- **Mark done only via the savings helper (Step 5)** — it writes `.graphify_batch_done` last. Never `touch` it yourself.
- **`count_tokens` is free** — never skip savings to "save cost"; there is none.
