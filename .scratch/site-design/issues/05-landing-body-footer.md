# 05 — Landing body + footer

**What to build:** The middle and bottom of the landing page: the two "What you get" cards (Docs as Markdown / Knowledge graph), the four headline stat tiles (build cost saved, build time done, GraphScore, tokens saved), the "How it works" four-step grid, the "Why a knowledge graph" section, the Support section (Star on GitHub / GitHub Sponsors / Buy Me a Coffee), and the footer. The stat tiles reuse the catalog data client from ticket 04 and are honest — a real representative doc's metric or a labelled aggregate, never fabricated.

**Blocked by:** 04.

**Status:** done 2026-07-21

- [x] The two "What you get" cards, the four stat tiles, the how-it-works steps, and the why-a-knowledge-graph section render themed, using the design's copy verbatim.
- [x] Every stat-tile value is honest — a real representative doc's metric or a labelled aggregate from the catalog, with its basis labelled; a value the data lacks shows `—`; nothing is fabricated (ADR-0006).
- [x] The Support section and footer link Star on GitHub, GitHub Sponsors, Buy Me a Coffee, and the OSS repo; no paywall or other monetization appears (ADR-0005).
- [x] The full landing page has no horizontal scroll on mobile; any wide block scrolls inside its own container.

## Comments

Built as `lib/stats.ts` (pure honesty seam: representative doc = first ready doc,
`—` for every absent metric) + `stat-tiles.tsx` (live) + `landing-sections.tsx`
(static WhatYouGet/HowItWorks/WhyGraph/Support/SiteFooter, design copy verbatim),
wired into `app/page.tsx` in Frame A order. `hero_savings` resolved to build-cost
USD (savings metric #1). 6 new unit tests; full web suite 20/20; typecheck clean.
Verified live at mobile-ish width: honest all-`—` tiles + catalog error state
degrade cleanly, no h-scroll.
