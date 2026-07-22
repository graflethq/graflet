-- Ticket 08 — per-version graph size + build time. The pipeline's /catalog/upsert
-- fills these as builds land; older frozen rows keep NULL. Feed the catalog table's
-- "Graph size" (nodes·edges) and "Updated" (built_at) columns — `—` while NULL.
ALTER TABLE doc_versions ADD COLUMN nodes    INTEGER;  -- KG node count; NULL until a build supplies it
ALTER TABLE doc_versions ADD COLUMN edges    INTEGER;  -- KG edge count; NULL until a build supplies it
ALTER TABLE doc_versions ADD COLUMN built_at TEXT;     -- ISO-8601 UTC build time; NULL until built
