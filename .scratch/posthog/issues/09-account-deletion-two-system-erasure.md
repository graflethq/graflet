# 09 — Account deletion: erase our row *and* the PostHog person

**What to build:** A way for a signed-in user to be deleted, that deletes them from **both** systems. This ticket
exists because ticket 02 found the obligation had no owner: `spec.md` lists *"Account erasure deletes the PostHog
person as well as our row"* under **Privacy obligations (not optional)**, and ADR-0010 records that *"erasure is now
a two-system operation … a GDPR obligation, not housekeeping"* — but there is no account-deletion path in the
codebase at all. The only `DELETE` statements in `apps/backend/src` are `pending_auth` cleanup in `auth.ts`. Until
this ships, `/privacy` truthfully says there is no delete button and points at `graflet@rnui.dev`, which makes
erasure a manual operator job with no runbook and no guarantee the PostHog half ever happens.

Deleting the row is not the hard part. The hard part is that a user is now spread across three tables and a US
third party, and a half-done deletion is worse than none — it leaves a person profile in PostHog keyed to a
`github_id` whose account no longer exists, which is precisely the state the obligation forbids.

**Blocked by:** 06 (the backend is where both halves have to happen, and it is where the PostHog server-side client
is first set up).

**Status:** needs-triage

- [ ] A deletion path exists and is reachable by the user it belongs to — either an authenticated endpoint the CLI
      and site can call, or a documented operator runbook. Whichever it is, `/privacy` is updated in the same commit
      to describe what actually exists, replacing the "no self-serve delete button yet" wording.
- [ ] Deleting removes **every** row keyed to that `github_id`: `users`, `tokens` (all machines, so a logged-in CLI
      cannot keep using a token belonging to a deleted account) and `subscriptions`. Verified by a test that seeds
      all three and asserts none survive.
- [ ] The same handler deletes the **PostHog person** for that `distinct_id` via their API, in the same request. A
      partial success is reported as a failure, not swallowed — an orphaned person profile is the exact outcome the
      obligation forbids.
- [ ] Deletion is idempotent: deleting an account that is already gone succeeds rather than erroring, so a retried
      request after a partial failure completes the job.
- [ ] The PostHog delete uses a **personal/API key held as a Worker secret**, never the public project token, which
      cannot delete anything. That is a second credential the Worker did not previously need — record where it lives.
- [ ] Whatever the user's browser holds is cleared too on a site-initiated delete: `graflet:session` and, if a
      PostHog SDK is running, `reset()` — otherwise the next page view re-creates a person for the account just
      erased.
- [ ] Backend vitest passes, run via a clean shell env (`ZDOTDIR=/nonexistent`, `ENV`/`BASH_ENV` unset) or the nvm
      `FUNCNEST` recursion kills the full run.
