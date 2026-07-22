-- Ticket 02 — the catalog tables. One authoritative list of the launch docs the
-- website + CLI read with NO sign-in (ADR-0005 gates only the KG download).
-- Ticket 01/03 own the identity tables (users/tokens/pending_auth); this owns the
-- catalog. Kept live by the pipeline + poller POSTing to /catalog/upsert.

-- docs: one row per library — the CLI's user-facing key (`graflet <slug>`).
-- Doc-level fields are the moving/current view; the frozen per-version detail
-- lives in doc_versions.
CREATE TABLE IF NOT EXISTS docs (
  slug            TEXT PRIMARY KEY,   -- CLI key, e.g. "next.js"
  name            TEXT NOT NULL,      -- display name, e.g. "Next.js"
  repo_url        TEXT NOT NULL,      -- github.com/{org}/{repo}
  license_id      TEXT NOT NULL,      -- current license (re-checked on every new version)
  popularity_rank INTEGER NOT NULL    -- lower = more popular; the default catalog sort
);
CREATE INDEX IF NOT EXISTS idx_docs_rank ON docs (popularity_rank);

-- doc_versions: one row per (slug, version_label). A version = document identity
-- (ADR-0003); old versions are KEPT and stay resolvable, `is_latest` is a moving
-- alias (at most one per slug). A row is frozen once `ready`: its
-- {sha, docs_path, kg_ref} pin never change — a new release adds a new row.
CREATE TABLE IF NOT EXISTS doc_versions (
  slug          TEXT NOT NULL REFERENCES docs(slug),
  version_label TEXT NOT NULL,        -- e.g. "16"; the identity axis (ADR-0003)
  is_latest     INTEGER NOT NULL DEFAULT 0,  -- 1 = the moving latest alias for this slug
  status        TEXT NOT NULL DEFAULT 'provisional'
                  CHECK (status IN ('provisional', 'graphifying', 'ready')),
  sha           TEXT,                 -- immutable 40-char commit pin (codeload); NULL until built (P1)
  docs_path     TEXT,                 -- upstream subtree holding the .md; NULL until built
  kg_ref        TEXT,                 -- location in the private KG repo; NULL until built
  license_id    TEXT NOT NULL,        -- license at build time; green-gated before ever going `ready`
  savings_json  TEXT,                 -- the bundle's savings.json blob (whatever exists yet)
  graphscore    REAL,
  hero_savings  REAL,                 -- the single headline savings number the site leads with
  needs_human   INTEGER NOT NULL DEFAULT 0,  -- 1 = unconfirmed version label (pending review); never served `ready`
  PRIMARY KEY (slug, version_label)
);
CREATE INDEX IF NOT EXISTS idx_versions_slug ON doc_versions (slug);
-- At most one latest alias per slug. The upsert flips the old one to 0 before
-- setting the new one to 1 (same transaction), so this never trips in normal use.
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_one_latest ON doc_versions (slug) WHERE is_latest = 1;
