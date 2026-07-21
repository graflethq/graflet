# ADR-0007 — Product/CLI name: Graflet

**Status:** Accepted (2026-07-21)

## Context
The product serves precomputed knowledge graphs of ~50k versioned library docs (graphs built by
[graphify](https://github.com/safishamsi/graphify)), positioned against context7.com — the differentiator being a
knowledge **graph** of the docs, not flat snippets. A future MCP server lets agents query the graph live. We needed
one brandable name for the product/site/repo and a short CLI, ideally free on npm + PyPI + a domain, distinct from
"graphify" and "context7".

Three naming rounds (coined → wide 4-style sweep → deep validation) landed on **Graflet** (CLI `graflet`, "GRAF-let").
Derivation: *graphlet* is a real graph-theory term (a small induced subgraph), collapsed onto the `graf-` root — so
the name signals both real graph structure and honest kinship to graphify (which literally builds the graphs).

## Decision
- **Name = Graflet.** Brand == CLI == npm pkg == PyPI pkg == MCP id, all lowercase `graflet`.
- **Keep the F-spelling** (not "graphlet"). Forced-and-correct: `graphlet` is taken on npm AND PyPI (PyPI owner is
  `graphlet.ai`, an adjacent graph-AI company), so we cannot ship as Graphlet — and the PH reads more academic and
  severs the graphify kinship.
- **The product unit is "a graflet"**: one library at one version (`react@18.3`) = one graflet. The diminutive scopes
  the *atom*; the catalog carries scale ("One graflet per version. 50,000 of them."). Copy must always pair the unit
  with the corpus, or the name defaults to reading "small/toy".
- **Positioning line:** *"Context7 sends your agent snippets to read; Graflet sends the graph to traverse."*
  Tagline: *"Docs as a graph, not snippets."*
- **Dual runner: `uvx graflet` (PyPI) and `npx graflet` (npm)** — ship the CLI on both registries so users reach it
  with whichever toolchain they already have, no install.
- **No domain for now** (free project). Home is the GitHub repo. `graflet.dev` is the future lead if/when bought
  (dev-native, HSTS-preloaded); `graflet.com` is squatter-parked — skip regardless.

## Availability (verified 2026-07-21, best-effort)
| Surface | Status |
|---|---|
| npm `graflet` | FREE (404) |
| PyPI `graflet` | FREE (404) |
| graflet.dev | Likely free (undelegated) — verify at registrar |
| graflet.io / graflet.sh | FREE |
| graflet.com | Taken (parked squatter) — skip |
| GitHub org `graflet` | Taken (dormant, 0 repos) → use `graflet-dev`, or personal `mrpmohiburrahman/graflet` for now |
| X `@graflet` | Taken (dormant 2013) → use `@graflethq` |
| Trademark / product rival "Graflet" | None found |
| `graphlet` (PH spelling) | Taken on npm + PyPI (`graphlet.ai`) — cannot fence the misspell |

## Consequences
- **Biggest risk: the "graphlet" misspell leak is uncapped** — cannot be fenced. Neutralize by making installs
  copy-paste-first everywhere (`pip install graflet` / `npm i graflet`), owning "graflet" SEO early, and shipping
  disambiguation microcopy ("graflet — spelled g-r-a-f-l-e-t, no p-h") in CLI first-run + docs header + OG.
- **graphify tether is soft, not welded**: `graf-` falls back to "graph", so "built by graphify" is a feature line,
  not a brand pillar — cuttable if the build engine changes (we already run multiple KG backends).
- Lock the names now with 0.0.1 placeholders on npm + PyPI (both scaffolded in `packages/graflet-npm` +
  `packages/graflet-pypi`, publishable as-is); host the repo on a personal account first and transfer to a free org
  later (transfer preserves stars/issues/history). GitHub orgs are free (Free plan) — no payment needed.
- Brand direction: lit-triad mark (small induced subgraph highlighted inside a dim larger graph), lowercase
  `graf`·`let` wordmark color-split, palette Graphite Ink `#14161D` + Filament Amber `#F6A821` (only warm play in a
  cool-toned category — context7 emerald, graphify blue/violet).
