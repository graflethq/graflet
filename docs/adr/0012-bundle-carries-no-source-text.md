# ADR-0012 — A bundle carries no source text, so an unlicensed source is shippable

**Status:** Accepted (2026-07-29)

## Context
[ADR-0002] justified two-source delivery on the grounds that we never redistribute a doc's markdown — the CLI
fetches it from upstream itself. That left an unexamined question: the KG *is* built from that markdown, and we
do host and distribute the KG. If a bundle embedded evidence snippets, a source repo with no licence (i.e. all
rights reserved, which is what "no LICENSE file" means) would be unshippable, and `Effect-TS/website` — the only
home of Effect's documentation — would have to be dropped from the catalog.

Verified against a shipped bundle (`mermaid-js/mermaid @0d1ee0a8`), file by file:

- `graph.json` — nodes carry `label`, `norm_label`, `source_file`, `file_type`, community id/name; links carry
  `relation`, `confidence`, `source_file`, `source`, `target`. **No field holds source prose.**
- `graph.html` — a viewer over that same JSON; its longest embedded strings are its own CSS and JS.
- `GRAPH_REPORT.md` — counts, extraction ratios, token cost, and the community/hub names.
- `savings.json`, `meta.json` — numbers only.

## Decision
Ship knowledge graphs of sources that state no licence. What a bundle contains is entity labels, relation types,
file paths, and our own clustering — facts about a document and structure we generated, not the document's
expression. Copyright protects expression; a factual index of what a doc covers and how its parts connect is not
the doc.

Where a `LICENSE` would go, an unlicensed source's bundle carries a **`NOTICE`** instead, naming the source repo
and commit, stating plainly that the bundle contains no text from the source, and pointing the reader at the
project to obtain the documentation. `/attribution` lists such a doc with its licence shown as "none stated" —
never a dash that could read as an oversight, and never a fabricated licence ([ADR-0006] honesty).

## Consequences
- `effect` is repointed to `Effect-TS/website` `src/content/docs/v3` rather than removed. `posthog` and
  `supabase-auth` were never at risk — PostHog grants MIT over the exact `/contents/` subtree pinned, and
  Supabase is Apache-2.0.
- `license_id` stays NULL for these rows; the NOTICE, not the licence field, carries the explanation.
- This holds only while the claim stays true. **Any change that puts source text into a bundle — evidence
  snippets on edges, quoted excerpts in the report, a summary field on nodes — voids this ADR** and must be
  raised before it ships.
- `fetch._is_license` still surfaces a real root LICENSE/COPYING/NOTICE when the source has one; the generated
  NOTICE is only for sources that have none.

[ADR-0002]: 0002-two-source-delivery-pinned-by-sha.md
[ADR-0006]: 0006-consent-and-audience-model.md
[ADR-0011]: 0011-split-docs-and-library-repos.md
