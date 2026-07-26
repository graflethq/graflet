# 02 — Privacy page rewrite + erasure path

**What to build:** The privacy page tells the truth about analytics *before* any analytics ships. Today
`apps/web/app/(legal)/privacy/page.tsx` says the page "captures nothing", lists exactly three stored fields, and
states that data is not shared with third parties — all three become false the moment PostHog is wired in, and a
privacy page that contradicts live behaviour is a liability, not an inconsistency (the same reasoning that forced
the landing-page fix in ADR-0009). The rewrite names PostHog as the analytics processor, says the data sits in the
**US**, lists what is sent (`github_id`, GitHub login, email), discloses **session replay** in plain words, and
explains how to opt out. It also makes erasure honest: deleting an account must delete the PostHog person too, not
just our row — a GDPR obligation, not housekeeping.

**Blocked by:** None — and it blocks deploying every other ticket.

**Status:** done 2026-07-26

- [x] The page names **PostHog** as the analytics processor, states the data is stored in the **United States**,
      and lists the three identifying fields sent to it (`github_id`, GitHub login, email). It also says outright
      that analytics requests come from a Graflet subdomain, so a content blocker may not stop them — that is the
      whole point of the managed proxy in ticket 01, and hiding it would be the dishonest half of the disclosure.
- [x] The page discloses, in plain language a non-lawyer understands, that **sessions on the site may be recorded**
      (mouse movement, clicks, pages visited) and that **what you type is masked** and not recorded — with the one
      deliberate exception named in the same breath: the catalog search term, which ticket 04 sends on purpose.
      Claiming "we never see what you type" while shipping `catalog_search` would have been the exact kind of
      contradiction this ticket exists to prevent.
- [x] The page distinguishes **anonymous** measurement (before sign-in, nothing stored on your device) from an
      **identified person** (after GitHub sign-in). No claim that the site "captures nothing" survives anywhere —
      the two stale `captures nothing` comments in `terms/page.tsx` and `(legal)/layout.tsx` were corrected too.
      A new **"What is stored in your browser"** section enumerates all three states, because the audit turned up
      an entry the old page never mentioned: `graflet:session` (`apps/web/lib/session.ts`), written after sign-in.
- [x] The page does **not** present marketing consent (ADR-0006) as covering analytics — the withdraw-consent
      section now ends with an explicit "that consent covers *email only*", and analytics has its own switch.
- [x] A named way to opt out of analytics is stated and actually works, not just described.
      `apps/web/lib/analytics.ts` + `apps/web/components/analytics-opt-out.tsx`: a button on `/privacy` that writes
      `graflet_analytics_opt_out` and pokes `window.posthog?.opt_out_capturing?.()` so it applies without a reload.
      Ticket 03's provider must read `isAnalyticsOptedOut()` **before** `posthog.init` — that is the seam.
- [x] Erasure covers both systems — **recorded as a gap, per this box's own escape hatch.** There is no
      account-deletion path in the codebase at all: the only `DELETE` statements in `apps/backend/src` are
      `pending_auth` cleanup in `auth.ts`. So the page promises no delete button and says so in those words; it
      names `graflet@rnui.dev` (Cloudflare Email Routing → Gmail, confirmed forwarding) and the repo issue tracker
      as the manual route, and commits to deleting both halves. The gap now has an owner: **ticket 09** was opened
      for the two-system delete path, because "recorded in a closed ticket" is not an owner and the obligation is
      listed under *Privacy obligations (not optional)*.
- [x] The existing legal-page tests still pass (`apps/web` vitest) — there were none, so the "captures nothing"
      wording was never encoded in an assertion to update. Added `app/(legal)/privacy/page.test.tsx` (6 cases) so
      the disclosure cannot silently regress, plus `lib/analytics.test.ts` (3 cases) over the real logic: the
      single-key round trip, the live-SDK poke, and storage-blocked private mode. Full suite 79 passed, 0 failed;
      `npm run typecheck` clean.
- [x] `/terms` and `/refunds` are checked for wording that the new disclosure now contradicts. Neither body text
      contradicts it — `/refunds` says nothing about data, and `/terms` only claims browsing needs no account,
      which stays true. A repo-wide grep for `no tracking` / `telemetry` / `analytics` / `cookie` across
      `apps/web` and `packages/cli/src` found no other claim to correct.

## Comments

**2026-07-26** — Two findings worth carrying forward.

**The browser opt-out is browser-scoped, and the page says so rather than implying otherwise.** Sign-ins and
brokered downloads are captured server-side against `github_id` (ticket 06), where a device-local switch cannot
reach. The page states that boundary in one sentence and points at deletion for anyone who wants those stopped too,
so nothing is promised that the code does not do. If ticket 06 ever wants to honour a per-account opt-out, that is
a new column and a new box — it is deliberately *not* implied here.

**Review caught three false claims in the first draft — all of them the same mistake this ticket exists to stop.**
Writing a privacy page from the design rather than from the code produces confident, checkable lies. Each was fixed
and each now has a test:

1. *"The CLI talks to the Graflet API … and that is all."* False. `packages/cli/src/md-fetch.ts:67` pulls the docs
   tarball from `codeload.github.com`, so GitHub sees the user's IP and which library they wanted. Now disclosed.
2. *"We keep one row for your account"* + three fields. False. `migrations/0001` also stores a hashed CLI bearer
   per logged-in machine and three consent timestamps; `0003` stores which libraries you watch. All now listed.
3. *"Three states, and that is the whole list"* for browser storage. False from ticket 05 onwards — sign-in turns
   PostHog persistence on, which writes `ph_*` keys. Now a fourth bullet, disclosed as the anonymous→identified
   boundary rather than discovered later by a reader with devtools open.

Also renamed the opt-out key `graflet_analytics_opt_out` → **`graflet:analytics-opt-out`** to match `SESSION_KEY`
in `lib/session.ts`. Both keys are printed by name on the page, so two conventions would have been visible to users,
not just to us.

**This page now ships ahead of the thing it describes.** Between this ticket and ticket 03 the site discloses
PostHog while capturing nothing. That over-disclosure is the safe direction and is the reason 02 is the gate, but it
means the page is only *fully* accurate once 03 and 06 land. Anything that changes what is sent changes this page in
the same commit.
