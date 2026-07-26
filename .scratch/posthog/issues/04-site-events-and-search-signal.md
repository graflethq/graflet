# 04 — Site explicit events + `catalog_search` demand signal

**What to build:** The five named site events from the spec, and in particular the one that answers "which docs
should I add next": every catalog search is captured with the text typed and how many rows it matched. This has to
be an explicit `capture()` — autocapture does not record typed text (PostHog: *"PostHog autocapture doesn't capture
the text that users enter"*) and replay masks inputs — so without this ticket the demand question stays
unanswerable no matter how much else is captured. Search is pure client-side filtering over the already-fetched
catalog (`apps/web/components/catalog-section.tsx:71`), so the event fires from a debounced effect on the query,
never per keystroke: one event per search a human meant to run.

**Blocked by:** 03.

**Status:** done 2026-07-26

- [x] `catalog_search` fires with `query` and `result_count`, debounced (~500 ms idle) so typing `react` sends **one**
      event, not five. Verified by typing in the box and counting events.
- [x] `query` is lowercased and truncated to 64 characters before sending. It is a free-text field a user could paste
      anything into; truncation and case-folding keep it a search term rather than an accidental payload.
- [x] An empty/whitespace query sends nothing.
- [x] `command_copied` fires from `apps/web/components/copy-button.tsx` with `doc`, `version` and `surface`
      (`hero` vs `catalog_row`) — the button is shared, so the caller distinguishes where it was clicked.
- [x] `doc_row_click` fires with `doc` and `version`.
- [x] `signin_started` fires with `surface` from `apps/web/components/join-panel.tsx` — the front half of the funnel
      whose back half is `signin_completed` in ticket 06.
- [x] `support_click` fires with `tier` from `apps/web/app/support/page.tsx`.
- [x] Event names and property names match `../spec.md` exactly — a typo here is a permanently split series, since
      captured events cannot be renamed retroactively.
- [x] A test covers the debounce and the truncation (the two bits of real logic), and existing component tests for
      `copy-button` / `catalog-section` still pass.

## Comments

**2026-07-26 — built.** All five events go through one door: `capture()` in `apps/web/lib/analytics.ts`, which
no-ops unless `posthog.__loaded` — with no project token (local dev, vitest) or on an opted-out device the SDK is
never initialised, and posthog-js logs an error for every capture made before init. `searchTerm()` sits beside it
and holds the case-folding + 64-char clip.

Three things the ticket didn't say and the code had to decide:

- **`doc_row_click` had no trigger.** Catalog rows are not links and nothing in them navigates, so the event fires
  from a `TableRow onClick` that changes nothing visually. The copy button lives *inside* the row, so the handler
  returns early on `e.target.closest("button")` — otherwise one copy reported two events. A test asserts the single
  event.
- **`surface` values are `hero` / `catalog_row` (per spec) and `join_panel`** — `JoinPanel` renders on `/join` only.
- **`app/support/page.tsx` is a server component** (it exports `metadata`), so the ten tier buttons moved to
  `apps/web/components/support-tiers.tsx` (`"use client"`) unchanged apart from the `onClick`. No other way to hang
  a handler on them without giving up `metadata`.

`signin_started` fires inline before a top-level navigation to the backend's OAuth start. Not given
`transport: 'sendBeacon'`: posthog-js flushes its queue on `pagehide`, and `capture_pageleave: true` (ticket 03)
already has that path registered. If the funnel's front half ever reads low against ticket 06's `signin_completed`,
this is the first thing to suspect.

**2026-07-26 — review (`/code-review-mp`) caught one real bug in the above, now fixed.** `catalog_search` fired
without checking `load.status`. While the catalog fetch was in flight — and permanently, if it failed — `rows` is
empty, so a search typed into a half-loaded page reported `result_count: 0`, indistinguishable from a genuine "we
don't have react". Worse, `rows.length` being an effect dep meant the same search then fired a *second* time when
the data landed. That corrupts the exact number this ticket exists to produce. Guarded with
`if (!q || !ready) return`, and the regression test was mutation-checked: it fails without the guard.

Four smaller review fixes: `capture()` takes a `SiteEvent` union instead of `string`, so a typo'd event name is a
compile error rather than a permanently split series; `CopyButton`'s payload prop is required and renamed
`copyEvent` (optional traded a compile error for a silently unmeasured copy, and `event` read as a DOM event);
`spec.md`'s taxonomy row for `support_click` now names the file it actually fires from; and the row-click handler
carries a `ponytail:` marker stating that it is pointer-only, so `doc_row_click` under-counts keyboard users and is
never a denominator.

`npm test` 96/96, `npm run typecheck` clean, `npm run build` clean. Not yet deployed — the events are wired but no
production traffic has produced one; ticket 08 builds the dashboard that reads them.
