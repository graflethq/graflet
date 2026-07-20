-- Ticket 08 — watch subscriptions. One row per (user, doc): a signed-in user who
-- asked to be emailed when any version of that doc goes `ready` (ADR-0006 service
-- notification). Consent lives on the users table (0001); this owns only the
-- subscription edge. The ready signal comes through /catalog/upsert flipping a
-- doc_versions row to `ready` — the upsert then emails every subscriber here.
CREATE TABLE IF NOT EXISTS subscriptions (
  github_id  INTEGER NOT NULL REFERENCES users(github_id),
  slug       TEXT NOT NULL REFERENCES docs(slug),
  created_at TEXT NOT NULL,               -- ISO-8601 UTC, first watch; re-watch is a no-op
  PRIMARY KEY (github_id, slug)           -- idempotent: watching twice is one row
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_slug ON subscriptions (slug);
