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

**Status:** done 2026-07-26 — **built and tested, not yet live**. Two deploy steps stand between this and a working
delete button; see "Before this works in production" below.

- [x] A deletion path exists and is reachable by the user it belongs to — either an authenticated endpoint the CLI
      and site can call, or a documented operator runbook. Whichever it is, `/privacy` is updated in the same commit
      to describe what actually exists, replacing the "no self-serve delete button yet" wording.
      **Two legs, and the split is the security property.** Leg one is the existing website OAuth round trip flagged
      `intent=delete` (`auth.ts`), which proves who is asking — the website mints no bearer token at all (ADR-0001),
      so a website-only account had nothing else to authenticate with. It deliberately does **not** delete: GitHub
      re-authorizes an already-approved app with no user interaction, so a bare link to
      `…/auth/web/start?intent=delete` would have been a one-click account wipe. It mints a one-time token on the
      `pending_auth` row instead. Leg two is `POST /account/delete {token}` (`account.ts`), reached only from the
      typed confirmation in `components/delete-account.tsx` on `/privacy#delete`.
- [x] Deleting removes **every** row keyed to that `github_id`: `users`, `tokens` (all machines, so a logged-in CLI
      cannot keep using a token belonging to a deleted account) and `subscriptions`. Verified by a test that seeds
      all three and asserts none survive. `deleteAccount()` runs all four deletes in one `env.CATALOG.batch()` (one
      transaction), and `pending_auth` is the fourth: ticket 07 put a `github_id` on it, and an in-flight row holds a
      raw bearer, a login and an email. `account.test.ts` seeds two token rows on purpose and additionally proves the
      end-to-end consequence — a deleted account's bearer gets 401 from the download broker, not just a missing row.
- [x] The same handler deletes the **PostHog person** for that `distinct_id` via their API, in the same request. A
      partial success is reported as a failure, not swallowed — an orphaned person profile is the exact outcome the
      obligation forbids. `deletePerson()` in `analytics.ts` — the opposite contract to `createTracker` in the same
      file: awaited rather than `waitUntil`, and throwing rather than swallowing. `POST
      /api/projects/:id/persons/bulk_delete/` with `{distinct_ids, delete_events, delete_recordings}`; `bulk_delete`
      rather than `DELETE /persons/:id/` because the latter wants the person UUID we do not have, making it two round
      trips and a race. A non-2xx **and** a non-empty `deletion_errors` array in an otherwise-2xx body both fail —
      PostHog reports per-person failures in the body, so status alone would turn exactly those into a false success.
- [x] Deletion is idempotent: deleting an account that is already gone succeeds rather than erroring, so a retried
      request after a partial failure completes the job. Passing a distinct id rather than a UUID is what buys this —
      an id matching nobody returns `persons_found: 0` and a 202, not an error. Tested three ways: a second full round
      trip for an already-deleted identity, a retry of the same link after an induced PostHog outage, and the replay
      guard (the token dies with the `pending_auth` row inside the successful batch).
- [x] The PostHog delete uses a **personal/API key held as a Worker secret**, never the public project token, which
      cannot delete anything. That is a second credential the Worker did not previously need — record where it lives.
      `POSTHOG_PERSONAL_API_KEY` (scope `person:write`), declared in `.dev.vars.example`,
      `worker-configuration.d.ts` and the secrets comment in `wrangler.jsonc`, with the reasoning in ADR-0010's
      ticket-09 amendment. Absent = deletion **fails**, unlike capture's silent no-op: succeeding without it would
      report a two-system erasure that only ever happened in one system. `POSTHOG_PROJECT_ID` rides along as a plain
      var (it is a path segment in every PostHog app URL, not a secret).
- [x] Whatever the user's browser holds is cleared too on a site-initiated delete: `graflet:session` and, if a
      PostHog SDK is running, `reset()` — otherwise the next page view re-creates a person for the account just
      erased. `clearSession()` then `forgetPerson()` (which is `reset()` + persistence back to memory-only), and only
      on success — a failed deletion must not throw away the local state of an account that still exists. Both
      asserted, in both directions, in `delete-account.test.tsx`.
- [x] Backend vitest passes, run via a clean shell env (`ZDOTDIR=/nonexistent`, `ENV`/`BASH_ENV` unset) or the nvm
      `FUNCNEST` recursion kills the full run. Backend 92/92 (14 new in `account.test.ts`), web 124/124 (5 new in
      `delete-account.test.tsx`); `tsc --noEmit` clean in both.

## Caught in review, after the first working version

A `pending_auth` row now belongs to exactly one errand, and **every** lookup has to say which. That was not true in
the first version. `pending_auth.token` had only ever been written by the CLI handoff, so `handleCliCallback` and
`handleCliPoll` both matched on `state` alone — safe until this ticket parked a second kind of token on the table.
Two ways through:

- `POST /auth/cli/poll {state}` on a deletion handoff returned that account's one-time delete token *and* deleted
  the row — handing an attacker who knew the state exactly the credential the confirmation step exists to gate.
- `GET /auth/cli/callback?state=<deletion state>` ran the CLI exchange over the deletion row, overwriting its token
  with a live bearer that `POST /account/delete` would then spend, and re-creating the user row being erased.

Both lookups are now scoped `AND return_to IS NULL` — the same discriminator `handleWebCallback` already used to
mean "this state belongs to the CLI flow". One test per direction, and both were confirmed to fail with the guard
removed rather than merely asserted.

Two smaller fixes from the same pass: `expires_at` is restamped when the delete token is minted (it was inheriting
whatever was left of the window after the GitHub round trip, so the retry guarantee was shorter than claimed and no
instant test could see it), and `corsPreflight` now answers per path rather than advertising `POST` on the public
catalog reads.

## Before this works in production

Nothing in this ticket has any effect on a user until both of these happen. Until then `/privacy` shows a delete
button whose second leg would return 502 — the safe failure, but a broken one.

1. **Create the PostHog personal API key** at `us.posthog.com/settings/user-api-keys`, scope `person:write` only,
   and set it: `wrangler secret put POSTHOG_PERSONAL_API_KEY` (in `apps/backend/`). The value is shown once.
2. **Deploy both apps** — the Worker (which also applies migration `0008_pending_auth_intent.sql`) and the site.

Then verify end to end on production with a throwaway GitHub account: sign in, confirm a person exists in PostHog,
delete, and confirm both the `users` row and the person are gone.

## Deliberately not built

- **No `graflet account delete` CLI command.** The website path covers every user, CLI users included — they all
  have a browser, and the flow needs one anyway to re-authenticate with GitHub. Add the subcommand the day someone
  needs a headless erasure; it would call the same `deleteAccount()`.
- **No operator runbook.** The ticket allowed one as the alternative to a self-serve path. A self-serve path exists,
  so a second, manual, un-tested way to do the same thing would be a liability rather than a backstop.
