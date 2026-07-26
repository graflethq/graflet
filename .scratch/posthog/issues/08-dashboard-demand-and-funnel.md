# 08 — Dashboard: missing-doc demand list + site→CLI funnel

**What to build:** The captured data becomes two answers you look at, rather than a pile of events you don't. First:
the **missing-doc demand list** — the top `catalog_search` queries where `result_count = 0`, i.e. the libraries
people came looking for and Graflet does not carry. That list is the direct input to what `kg-pipeline` builds next,
which was the stated reason for capturing search text at all. Second: the **acquisition funnel**, landing pageview →
`command_copied` → `signin_started` → `signin_completed` → `kg_download_brokered`, which shows where people fall
out of the one flow the product exists to serve. Both live on one dashboard with the supporting tiles beside them.

**Blocked by:** 04, 06, 07.

**Status:** needs-triage

- [ ] A dashboard named for this product exists in the `graflet` project, and every insight on it is saved (not an
      ad-hoc query someone has to rebuild).
- [ ] **Missing-doc demand**: top `catalog_search` `query` values filtered to `result_count = 0`, over a rolling
      window, ordered by count. Sanity-checked against a search you run yourself for a library that isn't in the
      catalog.
- [ ] **Found-but-ignored**: top `query` values where `result_count > 0` but no `doc_row_click` or `command_copied`
      follows in the session — a different problem from a missing doc (they found it and didn't want it) and worth
      separating.
- [ ] **Acquisition funnel**: pageview → `command_copied` → `signin_started` → `signin_completed` →
      `kg_download_brokered`, with the drop-off at each step visible.
- [ ] **Site→CLI**: `kg_download_brokered` vs `cli_download_completed` on one chart. The gap is downloads that were
      brokered but never landed — a reliability signal, not a duplicate.
- [ ] Tiles for the plain questions: pageviews by path, referrers, `support_click` count, `command_copied` by
      `surface`.
- [ ] An error-tracking view is pinned or linked, so backend exceptions (ticket 06) are somewhere you'd actually see
      them.
- [ ] Every insight is built on event/property names confirmed to exist in the project's schema — not on names
      copied from `../spec.md`, which is intent rather than evidence.
- [ ] Monthly usage is checked once against the free allowances (1M events, 5k replays) so the $0 billing limits from
      ticket 01 never actually bite and silently stop capture.
