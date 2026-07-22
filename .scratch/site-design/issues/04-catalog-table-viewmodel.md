# 04 — Catalog table: view-model module + live table

**What to build:** Below the hero, a visitor browses a live catalog table of every `ready` doc read from the catalog API — each row showing the library name + source repo, pinned version, GraphScore, tokens saved, graph size, updated, and a per-row copy-command button. A search box filters by library name; tabs re-sort the table (Popular / Smallest first / Recently built). Any missing metric renders `—`, never a guess. Loading and empty/error states never show a broken page. All reads need no sign-in and copying needs no auth. Graph-size and Updated show `—` until ticket 08 exposes their data.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] A pure catalog view-model module maps `(catalog API response, activeTab, searchQuery)` → the exact rendered rows — sorted per tab (Popular = GraphScore desc, Smallest first = nodes asc, Recently built = built_at desc), filtered by query, with `—` for every missing metric and the correct command string — and is unit-tested against fixture catalog JSON (prior art: `backend/src/catalog.test.ts`).
- [ ] The table uses the shadcn `table` primitive plus local component state (NO TanStack / data-table) and lists all `ready` docs from the live catalog API with no sign-in; the search box and all three tabs work.
- [ ] Each row's copy button copies `uvx graflet <slug>` with no auth call and no KG fetch (ADR-0005).
- [ ] A doc missing one or more metrics still renders its row, showing `—` for the missing value rather than a fabricated one (ADR-0006 honesty).
- [ ] Loading and empty/error states render gracefully if the catalog API is slow, empty, or errors.
- [ ] The Graph size and Updated columns render `—` until the catalog exposes `nodes/edges/built_at` (ticket 08), then show real values with no other change.
