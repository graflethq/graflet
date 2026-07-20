# docs-KG CLI v1 — ticket index

Source of truth: `../../../CONTEXT.md` + `../../../docs/adr/` + `../spec.md`.
Tracker: local files (one ticket per file). Work the **frontier** — any ticket whose blockers are all done — one at a time with `/implement`, clearing context between tickets.

## Tickets

| # | Title | Blocked by |
|---|---|---|
| 01 | Backend skeleton + secrets + health ✅ **done 2026-07-20** (commit `d5386a6`; 2 boxes operator-gated) | — |
| 02 | Catalog store + read/upsert API + seed ✅ **done 2026-07-20** (backend `catalog.ts`; sha/docs_path fill via upsert when P1 lands; 1 box operator-gated) | 01, P1, P3 |
| 03 | GitHub OAuth + CLI login/logout ✅ **done 2026-07-20** (backend `backend/` + CLI `cli/`; 2 boxes operator-gated) | 01 |
| 04 | CLI md-fetch module (codeload at pinned sha) | 02 |
| 05 | KG download broker + full `cli <slug>` download **(spine)** | 02, 03, 04, P1 |
| 06 | Website catalog + savings hero + free copy-command | 02, P2 |
| 07 | Website signup + unchecked marketing opt-in | 03, 06 |
| 08 | `cli watch` + Resend notifications + CLI consent | 02, 03 |
| 09 | Release poller (VPS) + Telegram ping *(v1-optional, last)* | 02 |
| 10 | Legal pages (Terms / Privacy / attribution) | 06 |
| P1 | **[kg-pipeline]** Re-graphify 39 from pinned HEADs + push private | — |
| P2 | **[kg-pipeline]** Finish savings metrics #2 + #4 | — |
| P3 | **[kg-pipeline]** Review 94 needs_human version rows ✅ **done 2026-07-20** | — |

`P1`/`P2`/`P3` are the separate **kg-pipeline** project (scheduled for the next day), not this repo's code — but they gate real tickets, so they are tracked here as blockers.

## Dependency order (blockers first)

```
P1 ─┐
P3 ─┼─► 02 ─┬─► 04 ─► 05 (spine)
01 ─┘       ├─► 06 ─► 07
            ├─► 06 ─► 10
            └─► 08
01 ─► 03 ─► 05 / 07 / 08
P2 ─► 06
02 ─► 09
```

## Frontier

- **Done:** `01` ✅, `02` ✅, `03` ✅, `P3` ✅. `02`'s code shipped ahead of P1 — the catalog seeds/serves now with `sha`/`docs_path`/`kg_ref` NULL; P1's re-graphify fills those pins via `/catalog/upsert`.
- **Startable now:** `P1` `P2` (kg-pipeline); `04` (CLI md-fetch — depends only on the `02` resolve contract, now defined); `06` needs `P2`.
- **After P1:** the resolve returns real pins → the spine `05` (needs `04`), and `04`/`06`/`08`/`09` proceed.

Realistic path: `01`+`03`+`02` ✅ done; next `P1/P2` (kg-pipeline) fill the pins + savings → `04` → spine `05`; `06`/`07`/`10` on the website side.
