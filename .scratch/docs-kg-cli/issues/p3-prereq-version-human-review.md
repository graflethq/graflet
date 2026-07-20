# P3 — [kg-pipeline] Review 94 needs_human version rows

> Separate **kg-pipeline** project (a data task on `programming-docs.db`), not this repo's code. Scheduled for the next day. Tracked here because it blocks the catalog seed (ticket 02).

**Scope note:** **94** = the `needs_human=1` / `confidence=low` rows within the programming-docs launch corpus (`programming-docs.db → programming_docs`, 50,218 rows). The earlier "110" figure was the low-confidence count across the full 106k-library `version-resolution.jsonl`; the non-programming remainder is deferred with the rest of that corpus. Only the 94 gate the launch.

**What to build:** When someone browses the catalog on the site or runs the CLI for any of the 94 low-confidence launch docs (next.js "16", typescript, huggingface/transformers, mui/material-ui, …), the version label they see is human-confirmed and the doc's default/latest alias points at its true newest release — no stale or auto-guessed label ships. In `programming_docs`, each of the 94 rows flagged `needs_human=1` gets a human to confirm or correct `version_label` and `is_latest` against the project's real releases, using the playbook's `release_axis` + `default_represents` (`version-resolution.jsonl`) and the upstream repo's tags, then clear `needs_human` so the catalog build treats those rows as trustworthy. Per ADR-0003 these are labels only: `version_label` is the frozen document-identity label at/above the release axis and `is_latest`/default is a moving alias never an identity — the KG stays keyed by `(repo, sha)` and no SHA is invented or changed.

**Blocked by:** None — can start immediately (kg-pipeline project, next day).

**Status:** done (2026-07-20) — applied + verified; see `../p3-version-review-report.md`. `needs_human=0`, `sha`/`repo_url` byte-identical vs `.p3bak`, spot-checks all current-stable. Rollback snapshot `programming-docs.db.p3bak` retained until ticket 02 ingests the catalog.

- [x] `SELECT COUNT(*) FROM programming_docs WHERE needs_human=1` returns 0 — all 94 launch-corpus rows reviewed, the flag cleared only after that row's `version_label` and `is_latest` are confirmed or corrected.
- [x] For each of the 94, `version_label` is the project's release-axis component consistent with the playbook's scheme/release_axis, with stale auto-guesses fixed (e.g. microsoft/typescript no longer carries a stale label).
- [x] Each row's `is_latest` reflects whether its default snapshot is the project's current newest stable release (1) or an older line the default still represents (0), so the catalog's latest alias never resolves to a stale doc (ADR-0003).
- [x] The `sha` and `repo_url` columns of the 94 rows are byte-identical before and after (diff them) — labels only, KG identity stays keyed by `(repo, sha)`.
- [x] Spot-checking a sample (next.js, typescript, huggingface/transformers, mui/material-ui) against each upstream repo's actual latest stable release confirms the shipped `version_label` is a current stable version, not a pre-release/canary tag.
