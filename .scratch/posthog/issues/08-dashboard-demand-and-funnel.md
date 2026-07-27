# 08 — Dashboard: missing-doc demand list + site→CLI funnel

**What to build:** The captured data becomes two answers you look at, rather than a pile of events you don't. First:
the **missing-doc demand list** — the top `catalog_search` queries where `result_count = 0`, i.e. the libraries
people came looking for and Graflet does not carry. That list is the direct input to what `kg-pipeline` builds next,
which was the stated reason for capturing search text at all. Second: the **acquisition funnel**, landing pageview →
`command_copied` → `signin_started` → `signin_completed` → `kg_download_brokered`, which shows where people fall
out of the one flow the product exists to serve. Both live on one dashboard with the supporting tiles beside them.

**Blocked by:** 04, 06, 07.

**Status:** done 2026-07-27, **built against production data and sanity-checked with a real search on
graflet.rnui.dev**. Dashboard: [Graflet — demand & acquisition](https://us.posthog.com/project/528914/dashboard/1908780)
(id `1908780`, pinned). Eleven tiles, ten saved insights plus a header text tile.

- [x] A dashboard named for this product exists in the `graflet` project, and every insight on it is saved (not an
      ad-hoc query someone has to rebuild).
      **`Graflet — demand & acquisition`, pinned.** Every tile is a saved insight with its own `short_id`, so it
      opens, edits and re-runs on its own. Tile order is deliberate: the two answers first, supporting tiles under
      them. The header text tile carries the reading instructions — including which series are legitimately empty,
      because a wall of zeroes on a pre-launch dashboard otherwise reads as broken wiring.
- [x] **Missing-doc demand**: top `catalog_search` `query` values filtered to `result_count = 0`, over a rolling
      window, ordered by count. Sanity-checked against a search you run yourself for a library that isn't in the
      catalog.
      **`Missing docs — searches that found nothing (30d)` (`npt7tfWB`).** HogQL table: `query`, `searches`,
      `people`, `last_searched`. **Sanity check run for real**, not asserted: searched `htmx` in the catalog box on
      production `graflet.rnui.dev`, which rendered *No libraries match "htmx"*; the event landed at
      `01:39:42Z` with `result_count = 0`, and `htmx` is now the top row of the tile.
      One trap worth recording for whoever reads this insight next: `insight-query` served a **stale cached
      result** that did not contain the new row, which looks exactly like a broken filter. `dashboard-insights-run`
      with `refresh: force_blocking` is what actually recomputes. Nothing was wrong with the query.
- [x] **Found-but-ignored**: top `query` values where `result_count > 0` but no `doc_row_click` or `command_copied`
      follows in the session — a different problem from a missing doc (they found it and didn't want it) and worth
      separating.
      **`Found but ignored — results returned, nothing clicked (30d)` (`lPJcTL2T`).** The word doing the work in
      that sentence is **follows**, and the first version of this insight ignored it: it excluded any session that
      had *ever* fired a `doc_row_click` or `command_copied`, at any point. Review caught the difference with a real
      counterexample — `mo` (`result_count = 3`) was searched at `18:18:50Z`, *after* that session's only click
      (`18:18:13Z`) and copy (`18:18:26Z`). Nothing followed it, so it is precisely the case the box asks for, and
      the session-wide version hid it.
      Now order-aware: a window function carries the session's last click-or-copy timestamp onto each search row,
      and a search survives only if no such event came after it. `mo` is the one row it returns today.
- [x] **Acquisition funnel**: pageview → `command_copied` → `signin_started` → `signin_completed` →
      `kg_download_brokered`, with the drop-off at each step visible.
      **`Acquisition funnel — landing to first download` (`hRRnVE48`).** Ordered, 14-day conversion window, steps
      given plain-English names. It spans site *and* Worker events in one funnel, which only works because
      ticket 05's identity merge put both on one `person_id`. Reads today: 21 land, 1 copies (4.76%), 0 beyond.
      The zero at `signin_started` is honest rather than broken — the one sign-in on record happened before any
      `command_copied` existed, and an ordered funnel will not count a step taken out of sequence.
- [x] **Site→CLI**: `kg_download_brokered` vs `cli_download_completed` on one chart. The gap is downloads that were
      brokered but never landed — a reliability signal, not a duplicate.
      **`Site → CLI — brokered vs landed downloads` (`BazVqWsY`).** Both series flat zero: the Worker has brokered
      no downloads and the CLI carrying `cli_download_completed` is built but unpublished (ticket 07). The chart is
      correct and waiting; it is not measuring anything yet.
- [x] Tiles for the plain questions: pageviews by path, referrers, `support_click` count, `command_copied` by
      `surface`.
      **`Pageviews by path (30d)` (`c7uqADgL`)** — `$pathname`, with `breakdown_path_cleaning` on. That flag is a
      **no-op today**: the project has no path-cleaning rules defined, so nothing is rewritten. It is left on so
      that adding a rule later (an `/docs/:slug` collapse, say) takes effect here without editing the tile.
      **`Where visitors come from (30d)` (`nxVMS2xE`)** — `$referring_domain`; already showing
      `com.linkedin.android` as a real referrer alongside `$direct`.
      **`Commands copied, by surface (30d)` (`cnzuDSec`)** — `hero` vs `catalog_row`.
      **`Support clicks (30d)` (`ZH2az6CC`)** — bold number, currently 0.
- [x] An error-tracking view is pinned or linked, so backend exceptions (ticket 06) are somewhere you'd actually see
      them.
      Two ways in, because a link alone is easy to never click: **`Exceptions — Worker and browser (30d)`
      (`r1JKyh8r`)** puts the volume on the dashboard broken down by `$lib` — `posthog-edge` is the Worker (the
      value the events actually carry; `posthog-node` is the package name, not the label) and `posthog-js` is the
      browser — and the header text tile links
      [Error tracking](https://us.posthog.com/project/528914/error_tracking) for the stack traces.
      The view is not empty: it holds one active issue, `posthog person deletion is not configured`, 2 occurrences
      at `00:26Z` and `01:16Z` on 2026-07-27. Those predate ticket 09's closing commit (`1fb9251`, `01:19Z`) — they
      are the verification run before `POSTHOG_PERSONAL_API_KEY` was set, not a live defect.
- [x] Every insight is built on event/property names confirmed to exist in the project's schema — not on names
      copied from `../spec.md`, which is intent rather than evidence.
      Confirmed twice over, because neither check alone is sufficient. **Ingested**: a `GROUP BY event` over 30 days
      of the real project returned `catalog_search`, `doc_row_click`, `command_copied`, `signin_started`,
      `signin_completed`, `cli_command_run`, `cli_download_failed`, `$pageview`, `$exception`. **Emitted**: every
      name used on a tile was traced back to a call site in `apps/web/lib/analytics.ts`,
      `apps/backend/src/analytics.ts` and `packages/cli/src/telemetry.ts` and their callers.
      The two checks disagree, and the disagreement is the useful part. `kg_download_brokered`,
      `cli_download_completed`, `support_click` and `watch_created` have real emitters but **no rows yet** —
      pre-launch, not wrong — so they are on the dashboard with the header tile explaining the zero.
      `watch_removed` has **neither**: `spec.md` names it, no endpoint fires it, and it is absent from the project
      taxonomy entirely. It is therefore **on no tile**. Building it from the spec name would have been the exact
      failure this checkbox exists to prevent — a series that can never move, which reads as a product nobody uses
      rather than a measurement nobody wired.
      Property names were read off the events themselves rather than assumed: `query`, `result_count`, `doc`,
      `version`, `surface`, `is_new_user`, `command`, `cli_version`, `reason`.
- [x] Monthly usage is checked once against the free allowances (1M events, 5k replays) so the $0 billing limits from
      ticket 01 never actually bite and silently stop capture.
      Checked, and then made durable instead of one-off: **`This month vs the free allowance` (`mpGe8aGC`)** puts
      the month-to-date counts next to the allowances on the dashboard. Current headroom is enormous —
      **511 events against 1,000,000** and **37 replays against 5,000** — but the failure mode here is silent
      (limits are $0, so exceeding an allowance stops capture rather than charging), which is precisely the kind of
      thing nobody notices without a tile.

## Comments

**No code changed.** This ticket is configuration in a third-party product; the repo diff is this file, the index
and an ADR amendment. Nothing to typecheck and no test to add — the tiles are verified by recomputing them against
production data, which is what `dashboard-insights-run` does above.

**Two tiles are more than the ticket asked for, deliberately.** The usage tile turns "checked once" into a standing
check, because the failure it guards against is silent. The header text tile exists because a pre-launch dashboard
is mostly zeroes, and without a note saying which zeroes are expected the honest reading is "the wiring is broken".

**Review (`/code-review-mp`) changed the deliverable, not just the prose.** Two of its findings were real defects in
the dashboard: the found-but-ignored insight ignored event ordering and hid a genuine row, and the exceptions tile's
own description named the wrong `$lib` value. Both are fixed in PostHog; the boxes above describe the fixed
versions. A third finding — that this file claimed `watch_removed` had ingested rows — was a false claim in the
write-up with the right conclusion attached to it, now corrected.
