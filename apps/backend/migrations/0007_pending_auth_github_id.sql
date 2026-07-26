-- Ticket 07 — the CLI's opt-in telemetry identifies to the `github_id`, the same join key
-- the site and the Worker use. The CLI only ever learns who signed in from the poll response,
-- which until now carried the login and the email but not the id, so it had nothing stable to
-- `$identify` to (a GitHub handle can be renamed, and a renamed handle silently forks one
-- person into two). The callback already has the id in hand; park it on the handoff row so
-- poll can hand it over with the token.
ALTER TABLE pending_auth ADD COLUMN github_id INTEGER;  -- filled by the CLI callback; NULL on web rows
