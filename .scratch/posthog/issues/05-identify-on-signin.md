# 05 — Identify on sign-in: `github_id` + login + email

**What to build:** The moment a user signs in with GitHub, the anonymous visitor becomes an **identified person**:
persistence is switched on, `identify(github_id, { github_login, email })` runs, and the events they generated
earlier in the session stitch onto that person. `github_id` as `distinct_id` is the join key that makes the whole
design work — the backend (ticket 06) and the CLI (ticket 07) use the same value, which is the only reason a
landing pageview, a brokered download and a CLI run can appear on one timeline and in one funnel. Sign-in is also
the consent boundary chosen in ADR-0010: it is an explicit act with its own disclosure, which is why identification
happens here and nowhere earlier.

**Blocked by:** 03.

**Status:** ✅ **done 2026-07-26**

- [x] On successful sign-in, persistence is switched from `memory` to `localStorage+cookie` (via `set_config`, not a
      re-init) and `identify(String(github_id), { github_login, email })` runs exactly once per session.
      **Built as `identify(String(github_id), { github_login })` — `email` is set server-side instead**, by ticket
      06's `signin_completed` `$set`. The site never knew the email: it would have had to ride in the OAuth return
      fragment, which stays out of server logs but still lands in the address bar and in browser history. PostHog
      holds all three fields as promised; one of them just arrives from the Worker. `spec.md`'s event table is
      unchanged by this — only the identify call's second argument differs.
- [x] `distinct_id` is the numeric `github_id` as a string — **not** the login handle, which a user can change,
      which would silently fork one person into two.
      The backend now returns `github_id` in the callback fragment (`apps/backend/src/auth.ts`), and it is stored on
      `graflet:session` so later loads can identify without another round trip. `github_id` is **optional** on the
      session type: sessions written before this ticket stay valid rather than logging everyone out.
      **Those users are never identified, and not "until their next sign-in" — there is no next sign-in.**
      `join-panel.tsx` shows the "Signed in as" card for any session and offers no sign-in link, so the only route
      back is signing out and in again. It is a closed cohort that shrinks as sessions churn, and it was judged not
      worth a re-auth prompt for; see the follow-ups.
      One validation rule, `isGithubId` in `lib/session.ts`, is shared by the writer and the reader. Two rules let a
      value the writer rejects (`0`, a negative, a float) survive in storage and reach `identify(String(0))` on the
      next load — which is what a first pass actually did.
- [x] Anonymous events from earlier in the same session appear on the identified person afterwards (the
      anonymous→identified merge). Verified on a real sign-in, not assumed.
      **Verified live on production, 2026-07-26.** A real sign-in at `graflet.rnui.dev`, then queried in PostHog.
      The anonymous id was `019f9f21-b203-7432-a919-6542267e9afd`; every event either side of the boundary
      resolves to one `person_id`, `2580a34b-c055-5740-a827-f166fdc172ab`:

      | event | distinct_id | person_id |
      |---|---|---|
      | `$pageview` (anonymous, pre-sign-in) | `019f9f21-…` | `2580a34b-…` |
      | `signin_started` (anonymous) | `019f9f21-…` | `2580a34b-…` |
      | `signin_completed` (**Worker**) | `35300157` | `2580a34b-…` |
      | `$identify` — carried `$anon_distinct_id: 019f9f21-…` | `35300157` | `2580a34b-…` |

      The person carries both distinct ids and all three fields
      (`email: …@gmail.com`, `github_login: mrpmohiburrahman`). This also settles the `identified_only` question
      empirically: the pre-sign-in events were captured with `$process_person_profile: false` and are attributed to
      the person anyway.
      **Ticket 03's warning was right about the cause and the fix chosen was to carry the id, not to drop the box.**
      `lib/analytics.ts` parks `posthog.get_distinct_id()` in `sessionStorage` under `graflet:analytics-anon-id` on
      the sign-in click; `AnalyticsProvider` reads-and-removes it and passes it as `bootstrap: { distinctID }`, so
      the `identify()` on return emits `$identify` carrying `$anon_distinct_id` and the merge is the ordinary one.
      Two claims were checked against the SDK source rather than assumed, because both would have failed silently:
      - `bootstrap.distinctID` with `isIdentifiedID` unset marks the id anonymous (`posthog-core.ts:793-803`), which
        is what makes `identify()` emit `$anon_distinct_id` (`:2613-2629`). Marking it identified would not.
      - `person_profiles: 'identified_only'` does **not** prevent the merge. Pre-identify events carry
        `$process_person_profile: false`, but PostHog's ingestion writes a `person_distinct_id_overrides` row on
        merge specifically so those personless events resolve to the person
        (`docs/published/handbook/engineering/person-processing.md:189-200`; docs: "Past events are attributed to
        the person, but are otherwise unchanged"). An earlier reading that this made the carry pointless was wrong.
      **Still unverified end-to-end on the live site** — the funnel needs a real sign-in against production before
      the numbers are trusted. Everything below it is covered by tests.
- [x] A signed-out visitor who never signs in still has **no** `ph_*` cookie or localStorage key — ticket 03's
      guarantee must survive this change.
      Persistence stays `memory` for anyone without a `github_id` on their session. **One thing IS now written for a
      visitor who has not completed sign-in**: `graflet:analytics-anon-id`, at the moment they click "Sign in with
      GitHub". It is `sessionStorage` (one tab, gone when it closes), holds only a random id, and is deleted on
      return. /privacy names it explicitly rather than letting "before you sign in — nothing" quietly stop being true.
- [x] Sign-out calls `reset()`, so a shared machine does not attribute the next person's events to the previous one.
      `forgetPerson()` in `components/site-nav.tsx`. It also sets persistence back to `memory` — `reset()` alone
      mints a *fresh* anonymous id and would keep writing `ph_*` entries for a signed-out browser. Order matters and
      is asserted: `reset()` clears storage first, then writing stops.
- [x] Nothing beyond the three agreed fields is sent — no avatar URL, no org list, no token, no repo names.
      Asserted on the exact key set of the `identify()` payload, so an added field fails the test.
- [x] The wording on the privacy page (ticket 02) matches what this code actually sends, field for field.
      Rewrote the browser-storage list: `graflet:session` now says it holds the account id too, and the new
      `graflet:analytics-anon-id` entry has its own bullet explaining why it exists. Added that sign-out clears
      PostHog's entries, and that watching a library and a failed download are recorded. The page test now asserts
      the enumeration includes the new key.

## Settled after the live run

- **Anyone signed in before 2026-07-26 is never identified** — their `graflet:session` predates `github_id`. Fixed
  rather than left to churn: the account card now offers "Reconnect your account", a link (not the sign-in panel,
  which would re-show the marketing opt-in that ADR-0006 forbids re-asking) carrying their recorded consent answer
  so the server's `'unset'` guard finds nothing to change. This was not hypothetical — the first browser tested had
  exactly this session.
- **Walking the flow on production caught a bug the tests did not.** The reconnect link shipped without the
  `onClick` the sign-in button has, so it round-tripped and handed back a `github_id` with no `$anon_distinct_id`
  attached — an identified person with nothing merged into them, which is the entire point of the trip. Fixed and
  covered by a test that clicks the link.
- ADR-0010 said pre-login visitors have nothing stored on their device. Now false by one `sessionStorage` entry, so
  the ADR carries a dated amendment rather than being quietly contradicted by the code.

## Still open

- A **download** has not been observed on a real person's timeline — that needs a CLI download against production,
  and the funnel's last step is unverified. The four steps before it are confirmed.
- One junk `__probe_from_console` event exists in the project from isolating ingestion lag during this check.
  Harmless; ignore it in any query that counts events.
