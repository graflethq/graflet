# docs-KG CLI v1 — ticket index

Source of truth: `../../../CONTEXT.md` + `../../../docs/adr/` + `../spec.md`.
Tracker: local files (one ticket per file). Work the **frontier** — any ticket whose blockers are all done — one at a time with `/implement`, clearing context between tickets.

## Tickets

| # | Title | Blocked by |
|---|---|---|
| 01 | Backend skeleton + secrets + health ✅ **done 2026-07-20** (commit `d5386a6`; 2 boxes operator-gated) | — |
| 02 | Catalog store + read/upsert API + seed | 01, P1, P3 |
| 03 | GitHub OAuth + CLI login/logout | 01 |
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

- **Done:** `01` ✅, `P3` ✅.
- **Startable now:** `03` (needs only `01`); `P1` `P2` (kg-pipeline).
- **After P1 + P3 + 01:** `02` — then `04`, `06`, `08`, `09` open up, and the spine `05` after `03`+`04`.

Realistic path: `01` ✅ done; next `03` (this repo) + `P1/P2` (kg-pipeline); then `02` → the rest.
