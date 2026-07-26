# 05 — Identify on sign-in: `github_id` + login + email

**What to build:** The moment a user signs in with GitHub, the anonymous visitor becomes an **identified person**:
persistence is switched on, `identify(github_id, { github_login, email })` runs, and the events they generated
earlier in the session stitch onto that person. `github_id` as `distinct_id` is the join key that makes the whole
design work — the backend (ticket 06) and the CLI (ticket 07) use the same value, which is the only reason a
landing pageview, a brokered download and a CLI run can appear on one timeline and in one funnel. Sign-in is also
the consent boundary chosen in ADR-0010: it is an explicit act with its own disclosure, which is why identification
happens here and nowhere earlier.

**Blocked by:** 03.

**Status:** needs-triage

- [ ] On successful sign-in, persistence is switched from `memory` to `localStorage+cookie` (via `set_config`, not a
      re-init) and `identify(String(github_id), { github_login, email })` runs exactly once per session.
- [ ] `distinct_id` is the numeric `github_id` as a string — **not** the login handle, which a user can change,
      which would silently fork one person into two.
- [ ] Anonymous events from earlier in the same session appear on the identified person afterwards (the
      anonymous→identified merge). Verified on a real sign-in, not assumed.
      **⚠ Read before starting — ticket 03 (2026-07-26) found this box may be unsatisfiable as written.** Ticket 03
      ships `persistence: 'memory'`, and sign-in is a **full document navigation** off-site and back
      (`components/join-panel.tsx` → `authStartUrl(...)` → GitHub → our callback). The anonymous `distinct_id` lives
      only in memory, so it is gone by the time `identify()` runs on the page after the round trip: there is no
      anonymous id left to merge from. `identify()` itself still works, so the *identified* half of this ticket is
      fine — it is the stitching that does not survive. Resolve it deliberately, don't quietly drop it: either accept
      no merge (pre-sign-in pageviews stay on an anonymous timeline — and then fix the wording in spec.md, which
      promises "a person's site visit, backend download and CLI run land on one timeline"), or hand the anonymous id
      through the OAuth round trip (e.g. in the `state` param the backend already round-trips) and call
      `identify(github_id, …, { $anon_distinct_id })` on return, which is a new box and a backend change.
- [ ] A signed-out visitor who never signs in still has **no** `ph_*` cookie or localStorage key — ticket 03's
      guarantee must survive this change.
- [ ] Sign-out calls `reset()`, so a shared machine does not attribute the next person's events to the previous one.
- [ ] Nothing beyond the three agreed fields is sent — no avatar URL, no org list, no token, no repo names.
- [ ] The wording on the privacy page (ticket 02) matches what this code actually sends, field for field.
