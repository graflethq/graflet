# 06 — Website catalog + savings hero + free copy-command

**What to build:** Anyone can open the website's landing page and browse the full catalog of ready docs without installing anything, signing in, or being asked for an email. The page leads with the savings hero: a catalog-total header above a popularity-ranked list of per-doc rows, each showing the doc's name, its license, its popularity, and one honestly-labelled hero savings number. A visitor can expand any row (progressive disclosure) to see that doc's four savings metrics — build cost, local build time, GraphScore, and usage token savings — an inline preview of its `graph.html`, and a copy-the-command box that yields the exact CLI command for that doc (with `@version` when a specific version is picked). Copying the command requires no signup and triggers no GitHub OAuth and no KG download: the page only reads the read-only catalog API and never captures an email — the gate (GitHub sign-in) and the marketing opt-in live entirely in the CLI/signup flows (07, 08), never on this page.

**Blocked by:** 02 (the read-only catalog API), P2 (savings metrics #2/#4 complete, so the hero + expanded metrics are honest and full).

**Status:** ready-for-agent

- [ ] Landing page loads and lists every `ready` doc read from the catalog API, popularity-ranked by default, with no sign-in, no GitHub OAuth redirect, and no email/opt-in field anywhere on the page (ADR-0005).
- [ ] Each row shows the doc's name, `license_id`, popularity rank, and exactly one hero savings number; every displayed savings value carries its honesty label/basis from `savings.json`, and no value is shown that the savings data does not contain.
- [ ] Hero + total use a **single shared basis** (tokens-to-build) so the catalog-total header is a like-for-like sum of the per-row hero numbers; any doc missing that metric is excluded from the total and the exclusion is disclosed (no mixed-basis summing).
- [ ] Expanding a row (collapsed by default) reveals that doc's four savings metrics (build cost, local build time, GraphScore, usage token savings), an inline preview of its `graph.html`, and the copy-command box.
- [ ] The copy-command box copies the exact command for that doc (with `@<version_label>` appended when a non-latest version is selected) with no signup, no auth call, and no KG fetch initiated by the page.
- [ ] A doc missing one or more savings metrics still renders its row and hero, showing a not-yet-measured marker (e.g. `—`) rather than a fabricated or guessed value.
- [ ] The footer links the donation channels (GitHub Sponsors + Buy Me a Coffee) and the OSS repo; no paywall or other monetization appears (ADR-0005).
