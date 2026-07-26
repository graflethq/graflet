-- Ticket 09 — account deletion reuses the website OAuth round trip to prove who is
-- asking, so pending_auth needs to know which of the two errands a handoff is on.
-- NULL is an ordinary sign-in (every existing row); 'delete' means the callback
-- mints a one-time deletion token instead of signing anyone in, and never upserts
-- the user or touches their consent.
ALTER TABLE pending_auth ADD COLUMN intent TEXT;  -- NULL = sign-in | 'delete'
