-- Ticket 06 — the website sign-in reuses pending_auth's CSRF + expiry rows, but
-- unlike the CLI (which polls for a bearer token) it redirects the browser back to
-- the site and records the marketing opt-in in the same OAuth callback. Two
-- nullable columns carry the web-only handoff; CLI rows leave them NULL.
ALTER TABLE pending_auth ADD COLUMN return_to TEXT;  -- allow-listed site URL to send the browser back to
ALTER TABLE pending_auth ADD COLUMN consent TEXT;    -- signup opt-in answer, unchecked-by-default: 'yes' | 'no'
