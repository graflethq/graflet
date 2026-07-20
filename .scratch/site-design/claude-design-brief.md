# Generating the docs-kg site in Claude Design

How to use **Claude Design** (`claude.ai/design`) to generate landing-page directions,
and the paste-ready prompt. Researched against Anthropic's own docs + the live tool
(2026-07-20).

## What Claude Design is

Anthropic Labs Beta tool. Chat on the left, a **canvas** on the right — you describe,
it generates real **code** (HTML / React / SVG, not mockup images), then you refine via
chat, inline comments, dragging on the canvas, or custom sliders. Runs on Opus 4.8.

## Facts that shape the workflow

- **Variants are not auto-parallel.** One prompt → one design. To get a different
  direction the documented move is to tell Claude: *"Save what we have and try a
  completely different approach."* So a "generate the variants" prompt is a base prompt
  that asks for a few frames **plus a follow-up ladder** — don't expect 5-up from one shot.
- **shadcn/ui is a first-class design-system source.** Pick shadcn/ui as the base system
  and *"a shadcn/ui setup stays shadcn/ui."* Set the **Design system** dropdown to
  shadcn/ui (or import the repo) — **not** "UrgentFlow" (unrelated brand; it contaminates output).
- **HTML export is real.** Export button (upper-right) → **HTML bundle**, PPTX, PDF, or
  hand-off to Claude Code / Vercel / Lovable etc.
- **Direct handoff beats download.** From Claude Code, `/design-login` + the Claude Design
  connection pulls a design straight into the codebase — it "continues from your existing
  work instead of starting over from a screenshot." HTML download still works if simpler.

## Set this before prompting

| Control | Value |
|---|---|
| Design system | **shadcn/ui** (not UrgentFlow) |
| Template | None (or *UI mockups*) |
| Model | Opus 4.8 |
| Start from code | off |

## The self-executing prompt (paste into Claude Design)

```
GOAL
Design the marketing landing page for "docs-kg" (placeholder name), a free,
open-source developer CLI. Build it with shadcn/ui components + Tailwind, so the
output ports cleanly into a React/shadcn codebase. Real, functional layout — not a
mockup image. Support light AND dark mode.

AUDIENCE
Developers — especially people who feed documentation to AI coding tools (Claude,
Cursor). They're skeptical of marketing fluff and reward precision.

WHAT THE PRODUCT IS (content — use this copy, no lorem)
- One command: `npx docs-kg react`
- It downloads a library's docs as Markdown AND a pre-built KNOWLEDGE GRAPH of
  those docs (interactive graph + machine-readable graph.json), aligned to a pinned
  release. The knowledge graph is the value: it gives your AI far better, cheaper
  context than raw docs.
- Free + open source. Only downloading the KG needs a one-click GitHub sign-in;
  install / browse / copy command / star are free, no account.
- Goal: audience, GitHub stars, donations (GitHub Sponsors + Buy Me a Coffee). No paid plans.
- Four value metrics per library (stat cards, mark numbers "illustrative"):
  build cost saved ($0.42) · build time done (8m 12s) · GraphScore (91/100) ·
  token savings for your AI (~68% fewer tokens).
- Real libraries for the catalog grid: next.js, react, shadcn/ui, fastapi, prisma,
  playwright, vitest, laravel, django, zod, supabase.

LAYOUT (sections, in order)
1. Sticky nav: wordmark, links (Catalog, Docs, GitHub), "★ Star 2.4k", "Sign in with GitHub".
2. Hero: sharp headline, one-line subhead, a copyable command pill (`npx docs-kg react`)
   with copy button, primary CTA + "Star on GitHub", and a terminal panel showing sample output.
3. "What you get": two cards — the docs Markdown, and the knowledge graph.
4. Four metric stat cards (above).
5. How it works: 3–4 steps — run one command → sign in with GitHub → fetches docs from
   upstream + KG from the backend → both land locally, aligned to the same release.
6. Catalog preview: search box + card grid of the libraries + "Browse all →".
7. Why a knowledge graph: short value block for AI-coding-tool users.
8. Support: Star on GitHub / GitHub Sponsors / Buy Me a Coffee.
9. Footer.

DELIVERABLE
Produce THREE distinct full-page directions as separate frames on the canvas,
labeled A, B, C. Each is the complete landing page above; each commits hard to a
DIFFERENT aesthetic — do not share a look:
  A — Terminal / dev-dark: near-black, one electric accent, monospace command + code,
      terminal panel as the hero centerpiece.
  B — Clean docs-light (Stripe/Vercel/Linear): airy whitespace, refined sans, soft
      shadows, one restrained indigo accent, rounded cards, premium calm.
  C — Minimal mono / editorial: paper/off-white, near-black type, ONE accent used
      sparingly, hairline rules, big type scale, almost no shadows.
Keep markup semantic and shadcn-idiomatic — it will be reimplemented by a developer.
```

## Follow-up ladder (if it only makes one direction)

Send these one at a time after the first render:

1. `Save this as Direction A. Now try a completely different approach: Direction B — clean docs-light (Stripe/Vercel/Linear), airy, indigo accent, rounded cards. Same content and sections.`
2. `Save that as B. Now a completely different approach: Direction C — minimal mono / editorial, paper background, one accent, hairline rules, large type scale. Same content.`
3. Compare, then: `Take Direction <X> and refine: <specific tweaks>.`

## When a direction is picked

- **Simple:** Export → **HTML bundle** → drop the files in the repo (or give the path).
- **Better:** run `/design-login` in Claude Code, import the chosen design directly, and
  implement it in the real stack with components intact (no screenshot round-trip).

## Sources

- [Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
- [Set up your design system in Claude Design](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design)
- [Introducing Claude Design (Anthropic Labs)](https://www.anthropic.com/news/claude-design-anthropic-labs)
- [Claude Design product page](https://claude.com/product/design)

## Tweak: add a first-page catalog table (new version, keep base)

Chosen direction: **A — dark terminal**. Add an interactive catalog table high on the
page (like a dense dev data-table). Differentiated from any docs-index site by using
KG-native columns (GraphScore, tokens saved, graph size, version), own tab labels
(Smallest first / Recently built), a per-row copy-command action, and monospace terminal
styling — so it reads as this product's catalog, not a copy. Paste into the **same**
Claude Design chat for the design:

```
Keep the current design exactly as it is — same dark terminal aesthetic, monospace
type, green accent, all existing sections, colors, and spacing. Do NOT restyle anything.

First: save the current design as a version named "base" so it stays untouched.
Then create a NEW version based on it, and make only ONE change in that new version:

Add an interactive Catalog table high on the page — directly below the hero (above the
"What you get" section). Move the existing catalog card-grid up and REPLACE it with this
table, so there is no duplicate catalog.

The table:
- A search input above it, placeholder: "Search 39 libraries…"
- A row of tabs above the table: "Popular", "Smallest first", "Recently built"
  (Popular active by default).
- Columns (monospace, tabular numbers, right-align the numeric ones):
    LIBRARY       — name + faint repo path, e.g.  react    reactjs/react.dev
    VERSION       — pinned-release badge, e.g.  v19.1.0
    GRAPHSCORE    — e.g.  91/100
    TOKENS SAVED  — e.g.  ~68%
    GRAPH SIZE    — e.g.  1.2k nodes · 3.9k edges
    UPDATED       — relative, e.g.  4h ago
    (last cell)   — a small "copy command" button showing `npx docs-kg <slug>`
- Rows (use these libraries; numbers illustrative — vary them realistically):
    next.js, react, shadcn/ui, fastapi, prisma, playwright, vitest, laravel, django, zod, supabase
- A footer row under the table: left "39 libraries ready · 106k tracked",
  right "Browse all →".
- Style it as a dense developer data-table that matches the existing terminal look:
  hairline row dividers, subtle hover highlight, monospace throughout, green only as the
  accent (links, active tab, score). Rounded container matching the other cards.

Make it feel native to THIS product — a knowledge-graph catalog, not a generic docs index.
Keep everything else on the page identical to the base version.
```
