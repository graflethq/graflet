# 04 — Site explicit events + `catalog_search` demand signal

**What to build:** The five named site events from the spec, and in particular the one that answers "which docs
should I add next": every catalog search is captured with the text typed and how many rows it matched. This has to
be an explicit `capture()` — autocapture does not record typed text (PostHog: *"PostHog autocapture doesn't capture
the text that users enter"*) and replay masks inputs — so without this ticket the demand question stays
unanswerable no matter how much else is captured. Search is pure client-side filtering over the already-fetched
catalog (`apps/web/components/catalog-section.tsx:71`), so the event fires from a debounced effect on the query,
never per keystroke: one event per search a human meant to run.

**Blocked by:** 03.

**Status:** needs-triage

- [ ] `catalog_search` fires with `query` and `result_count`, debounced (~500 ms idle) so typing `react` sends **one**
      event, not five. Verified by typing in the box and counting events.
- [ ] `query` is lowercased and truncated to 64 characters before sending. It is a free-text field a user could paste
      anything into; truncation and case-folding keep it a search term rather than an accidental payload.
- [ ] An empty/whitespace query sends nothing.
- [ ] `command_copied` fires from `apps/web/components/copy-button.tsx` with `doc`, `version` and `surface`
      (`hero` vs `catalog_row`) — the button is shared, so the caller distinguishes where it was clicked.
- [ ] `doc_row_click` fires with `doc` and `version`.
- [ ] `signin_started` fires with `surface` from `apps/web/components/join-panel.tsx` — the front half of the funnel
      whose back half is `signin_completed` in ticket 06.
- [ ] `support_click` fires with `tier` from `apps/web/app/support/page.tsx`.
- [ ] Event names and property names match `../spec.md` exactly — a typo here is a permanently split series, since
      captured events cannot be renamed retroactively.
- [ ] A test covers the debounce and the truncation (the two bits of real logic), and existing component tests for
      `copy-button` / `catalog-section` still pass.
