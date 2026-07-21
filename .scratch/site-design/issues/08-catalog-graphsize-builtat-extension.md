# 08 — (optional) Backend catalog extension: per-version graph size + built_at

**What to build:** The catalog API exposes each version's **graph size** (nodes, edges) and **last-built timestamp**, sourced from the pipeline build record, so the catalog table's "Graph size" and "Updated" columns show real values instead of `—`. The pipeline's `/catalog/upsert` payload carries them; older frozen version rows keep whatever they had.

**Blocked by:** 02.

**Status:** done 2026-07-21

- [x] `GET /catalog` and `GET /catalog/{slug}` expose each version's `{nodes, edges, built_at}` (nullable until a build supplies them).
- [x] `POST /catalog/upsert` accepts and stores `nodes`, `edges`, and `built_at`; it stays idempotent and its auth/shared-secret is unchanged.
- [x] The catalog table (ticket 04) shows real Graph size and Updated when present and `—` when null, with no other change to the table.
- [x] Backend vitest covers the new fields on both read and upsert (prior art: `backend/src/catalog.test.ts`).

Landed: migration `0005_catalog_graph_metrics.sql`; catalog list/detail reads + upsert; web `relativeTime` formats `built_at` ("3h ago"…"2y ago") with an injected `now`. Pipeline emitting the fields (`kg-pipeline/post.py`) is out of scope — the endpoint now accepts them.
