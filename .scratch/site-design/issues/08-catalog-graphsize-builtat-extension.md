# 08 — (optional) Backend catalog extension: per-version graph size + built_at

**What to build:** The catalog API exposes each version's **graph size** (nodes, edges) and **last-built timestamp**, sourced from the pipeline build record, so the catalog table's "Graph size" and "Updated" columns show real values instead of `—`. The pipeline's `/catalog/upsert` payload carries them; older frozen version rows keep whatever they had.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] `GET /catalog` and `GET /catalog/{slug}` expose each version's `{nodes, edges, built_at}` (nullable until a build supplies them).
- [ ] `POST /catalog/upsert` accepts and stores `nodes`, `edges`, and `built_at`; it stays idempotent and its auth/shared-secret is unchanged.
- [ ] The catalog table (ticket 04) shows real Graph size and Updated when present and `—` when null, with no other change to the table.
- [ ] Backend vitest covers the new fields on both read and upsert (prior art: `backend/src/catalog.test.ts`).
