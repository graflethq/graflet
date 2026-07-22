-- Ticket 03 — the identity tables. Ticket 02 owns the catalog tables; this
-- migration owns only what GitHub OAuth needs: who signed in, what bearer
-- tokens the backend issued, and the short-lived browser-handoff rows.

-- users: the product's core asset (ADR-0006). One row per GitHub identity,
-- keyed by GitHub's stable numeric id (survives username changes).
CREATE TABLE IF NOT EXISTS users (
  github_id         INTEGER PRIMARY KEY,
  email             TEXT,                          -- primary verified email; NULL if GitHub exposes none
  created_at        TEXT NOT NULL,                 -- ISO-8601 UTC, first sign-in; never overwritten
  marketing_consent TEXT NOT NULL DEFAULT 'unset'  -- tri-state (ADR-0006); login NEVER sets it — 07/08 do
    CHECK (marketing_consent IN ('unset', 'yes', 'no')),
  consent_at        TEXT,                          -- when consent left 'unset'
  consent_source    TEXT                           -- 'website' | 'cli'
);

-- tokens: bearer tokens issued to the CLI. Stored as a SHA-256 hash, never the
-- raw value — a DB leak must not hand over live sessions. One row per login
-- (a dev's laptop and CI hold different tokens). Verified by tickets 05/08.
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  github_id  INTEGER NOT NULL REFERENCES users(github_id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_github_id ON tokens (github_id);

-- pending_auth: one row per in-flight browser sign-in, keyed by the CSRF `state`
-- the CLI polls on. The callback fills `token`/`login`/`email` (or `error`);
-- poll reads then deletes it. Expired rows are swept on the next start.
CREATE TABLE IF NOT EXISTS pending_auth (
  state      TEXT PRIMARY KEY,
  token      TEXT,   -- raw bearer, handed to the CLI once then the row is deleted
  login      TEXT,   -- GitHub login, for the CLI's "Signed in as …" line
  email      TEXT,
  error      TEXT,   -- set instead of token when the callback fails (denied / no email)
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
