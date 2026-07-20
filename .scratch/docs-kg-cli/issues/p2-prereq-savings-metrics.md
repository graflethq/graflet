# P2 — [kg-pipeline] Finish savings metrics #2 + #4

> Separate **kg-pipeline** project, not this repo's code. Scheduled for the next day. Tracked here because it blocks the website hero (ticket 06).

**What to build:** When a doc is graphified-and-scored, its bundle's `savings.json` comes out with all four savings metrics complete, not two. Today the pass writes build-cost (#1) and GraphScore (#3); this joins in local build-time (#2) and usage token savings (#4) keyed to the same doc snapshot. Metric #2 runs the on-device local model over the first few chunks/files of the corpus at publish time, times them, and extrapolates linearly to the whole corpus, recording the machine, the local model, and the sample basis so the number reads as an estimate. Metric #4 runs K representative questions for the doc, measuring tokens to answer via graphify's query tools versus stuffing the full docs into context, and reports the median percent reduction labelled "typical" with K and the baseline disclosed. Every number is measured on the dev machine, never guessed, so the four savings numbers the website hero (06) shows per doc are honest and defensible. Extends the existing `build_cost` + `accuracy` blocks where `savings.json` is assembled, rather than rewriting them. Follow `research/savings-metrics/REQUIREMENTS.md`.

**Blocked by:** None — can start immediately (kg-pipeline project, next day).

**Status:** ready-for-agent

- [ ] The savings pass writes a `savings.json` with all four blocks — build_cost, local_time, accuracy, usage — with the already-working build_cost (#1) and accuracy/GraphScore (#3) unchanged (join, not rewrite).
- [ ] The local_time block (#2) is produced by actually running the on-device local model over the first N chunks/files and extrapolating: local_model, machine, sampled_chunks, sample_elapsed_seconds, corpus_total_chunks, estimated_total_seconds, time_basis="extrapolated" all populated, none null.
- [ ] The usage block (#4) reports a measured median token reduction from answering K representative questions via graphify's query tools versus full docs in context: usage_sample_k, usage_baseline="full-docs-in-context", usage_median_token_reduction_pct, usage_label="typical" populated from real runs, not constants.
- [ ] Field names, nesting, and enum values match the `savings.json` schema in `research/savings-metrics/REQUIREMENTS.md`.
- [ ] Honesty guardrails hold on an existing bundle (e.g. shadcn): #2 labelled estimated/extrapolated and names machine + local model; #4 labelled typical and discloses K + baseline; all four resolve to real numbers feedable into the catalog hero — none presented as exact or a per-user promise.
