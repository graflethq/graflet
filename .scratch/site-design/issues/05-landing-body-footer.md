# 05 — Landing body + footer

**What to build:** The middle and bottom of the landing page: the two "What you get" cards (Docs as Markdown / Knowledge graph), the four headline stat tiles (build cost saved, build time done, GraphScore, tokens saved), the "How it works" four-step grid, the "Why a knowledge graph" section, the Support section (Star on GitHub / GitHub Sponsors / Buy Me a Coffee), and the footer. The stat tiles reuse the catalog data client from ticket 04 and are honest — a real representative doc's metric or a labelled aggregate, never fabricated.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] The two "What you get" cards, the four stat tiles, the how-it-works steps, and the why-a-knowledge-graph section render themed, using the design's copy verbatim.
- [ ] Every stat-tile value is honest — a real representative doc's metric or a labelled aggregate from the catalog, with its basis labelled; a value the data lacks shows `—`; nothing is fabricated (ADR-0006).
- [ ] The Support section and footer link Star on GitHub, GitHub Sponsors, Buy Me a Coffee, and the OSS repo; no paywall or other monetization appears (ADR-0005).
- [ ] The full landing page has no horizontal scroll on mobile; any wide block scrolls inside its own container.
