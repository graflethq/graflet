# Spec — docs-kg website (shadcn build of the chosen design)

**Status:** ready-for-agent
**Context:** `../../CONTEXT.md` + `../../docs/adr/` (esp. ADR-0001/0002/0005/0006). Read those first.
**Supersedes the *presentation* of** `.scratch/docs-kg-cli/issues/` **06 (catalog + savings hero), 07 (signup + opt-in), 10 (legal pages)** — this spec keeps every ADR constraint those tickets encode and replaces their "design when built" placeholder with the concrete, chosen design.
**Design source:** `.scratch/site-design/export/docs-kg Landing.dc.html` (Frame A — dark terminal, with the catalog table). **Build guide:** `../../research/shadcn-mcp-implement/FINDINGS.md`. **Prompt trail:** `claude-design-brief.md`.

---

## Problem Statement

The backend (Cloudflare Worker: catalog API, GitHub OAuth, KG download broker) and the CLI exist, but there is **no website**. A developer who hears about docs-kg has nowhere to land: no page to understand what it does, browse the catalog of ready docs, copy the install command, sign in to join the audience, or read the legal/attribution surface. Without the site there is no top of funnel — no path to the GitHub stars, the consented email list, and the donations that are v1's only success metric.

## Solution

A polished marketing website — the chosen **dark-terminal design (Frame A)** — built as a real React app with **shadcn/ui** components, that:

- Explains the product (hero: the one command, a terminal panel, "what you get", how-it-works, "why a knowledge graph").
- Shows a live, searchable **catalog table** of the ready docs (read from the existing read-only catalog API), each row carrying the doc's graph-quality/savings metrics and a **copy-the-command** button — all with **no sign-in, no email capture, no KG fetch** on the page (ADR-0005).
- Offers a **GitHub sign-in** that joins the audience, reusing the backend's OAuth exchange, with an **unchecked** marketing opt-in shown only while consent is `unset` (ADR-0006).
- Carries the minimal **Terms / Privacy / attribution** legal surface, static and public.
- Leads people to the CLI, GitHub stars, and donation channels (GitHub Sponsors + Buy Me a Coffee); no paywall (ADR-0005).

Every displayed savings/quality value is honest: only what the catalog data actually contains is shown; anything missing renders a not-yet-measured marker (`—`), never a fabricated number. The illustrative sample numbers baked into the design export are placeholders for real catalog data.

## User Stories

1. As a visitor, I want to open the landing page and immediately understand what docs-kg does, so that I can decide if it's for me.
2. As a visitor, I want to see the exact one-line command (`npx docs-kg react`) in the hero with a copy button, so that I can try it in seconds.
3. As a visitor, I want a realistic terminal panel showing what the command outputs, so that I trust the tool does what it says.
4. As a visitor, I want to copy the install command **without signing in or giving an email**, so that trying the tool is frictionless (ADR-0005).
5. As a visitor, I want to browse a catalog table of every ready doc, so that I can check whether the library I care about is covered.
6. As a visitor, I want each catalog row to show the doc's name and source repo, pinned version, GraphScore, token savings, graph size, and last-updated, so that I can judge the graph's quality and freshness at a glance.
7. As a visitor, I want to search/filter the catalog by library name, so that I can find a specific doc fast.
8. As a visitor, I want to re-sort the catalog (most popular / smallest first / recently built), so that I can browse the way that suits me.
9. As a visitor, I want a per-row copy-command button, so that I can grab the exact command for any doc (`npx docs-kg <slug>`), no sign-in.
10. As a visitor, I want any doc that is missing a metric to still appear, showing `—` for the missing value rather than a guessed one, so that I can trust every number on the page.
11. As a visitor, I want a "what you get" section contrasting the Markdown docs and the knowledge graph, so that I understand the two deliverables.
12. As a visitor, I want a small set of headline stat tiles (build cost saved, build time done, GraphScore, tokens saved), honestly labelled with their basis, so that I grasp the value quickly.
13. As a visitor, I want a "how it works" walkthrough (one command → sign in with GitHub → we fetch both → land locally aligned), so that I understand the flow before installing.
14. As a visitor, I want a "why a knowledge graph" section, so that I understand why the graph beats raw docs for my AI.
15. As a developer who feeds docs to an AI tool, I want the page to speak to token/context savings, so that I see how it helps my workflow specifically.
16. As a visitor, I want the page to render correctly on mobile with no horizontal scroll, so that I can read it on any device.
17. As a returning visitor, I want the page to load fast and be crawlable/SEO-friendly, so that it's discoverable and pleasant.
18. As a visitor who likes the project, I want obvious "Star on GitHub", "GitHub Sponsors", and "Buy Me a Coffee" actions, so that I can support it (the v1 goal).
19. As a visitor, I want to sign in with GitHub to join the audience, reusing the same identity the CLI uses, so that there's one account model (ADR-0001).
20. As a first-time signer-in, I want the marketing opt-in checkbox to be **unchecked by default**, so that my consent is real and lawful (ADR-0006).
21. As a signer-in who leaves the box unticked, I want my email captured but marketing consent stored as `no`, so that sign-in alone is never treated as consent (ADR-0006).
22. As a returning signed-in user who already answered the opt-in, I want to never be re-asked, so that my recorded consent value is respected and untouched (ADR-0006).
23. As a privacy-conscious visitor, I want a Privacy page disclosing what's stored (`github_id`, email, `marketing_consent`), the tri-state consent model, and how to unsubscribe/withdraw, so that I know my rights (ADR-0006).
24. As a visitor, I want a Terms page stating free + open-source, as-is, no warranty, so that expectations are clear.
25. As an upstream maintainer, I want an attribution page listing each redistributed doc's source repo and license, so that the green-license redistribution terms are met.
26. As any visitor, I want the legal pages linked in the footer and reachable with no sign-in and no data capture, so that they're transparent.
27. As a visitor, I want light and (primarily) dark presentation handled deliberately, so that the page looks intentional in either.
28. As the operator, I want the catalog table to reflect the live catalog API, so that new/updated docs appear without a site redeploy.
29. As the operator, I want the site to degrade gracefully if the catalog API is slow or empty (loading + empty states), so that it never shows a broken page.
30. As a keyboard/screen-reader user, I want semantic landmarks, focus states, and accessible controls, so that I can use the site.

## Implementation Decisions

**Stack & deployment**
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, deployed to **Cloudflare** (via `@opennextjs/cloudflare`, or Cloudflare Pages if SSG suffices). *Lighter alternative on the table: Astro + React islands — same shadcn components, less runtime. Stack is the one open decision; default is Next unless changed.*
- The site is a **separate frontend app** (new top-level dir, e.g. `web/`) that consumes the **existing backend Worker's** public catalog API. It runs **no server logic of its own** beyond rendering — OAuth exchange, catalog, and the download broker already live in `backend/`.
- The backend must **allow the site origin (CORS)** on the read-only catalog endpoints — small backend change, tracked as its own slice.

**Components (shadcn) & how they're sourced**
- Wire the **shadcn MCP server** for Claude Code (`npx shadcn@latest mcp init --client claude`; verify `/mcp` Connected) after `shadcn init`. Optionally add the shadcn Skill (`npx skills add shadcn/ui`).
- Primitives used: **button, card, badge, input, tabs, table, separator**. Everything else (terminal panel, command pill, stat tiles, step grid, hero gradients) is plain styled markup. **There is no add-able `data-table`** — the catalog table is the `table` primitive plus local `useState`/`useMemo` (no TanStack).
- `shadcn init` uses the **`new-york`** style and a `baseColor` chosen to match the dark palette; `style`/`baseColor`/`cssVariables` are **locked at init**, so pick up front.
- **Theme through CSS variables** (semantic OKLCH tokens under `:root`/`.dark`): translate the design's palette (bg `#0a0b0d`, accent green `#4ef08c`, borders `#1c2027`, JetBrains Mono) into tokens once; never restyle component classes per element. Frame A is **dark-committed**; a light theme is optional/later.

**Data source & the catalog table**
- Data comes from the read-only catalog API (ticket 02, done): `GET /catalog` (list: slug, name, license, popularity, latest version, hero savings) and `GET /catalog/{slug}` (detail: versions, savings, GraphScore, resolve). No auth for reads (ADR-0005).
- Table columns map to catalog fields: **Library** = name + `repo_url`; **Version** = `version_label`; **GraphScore** = `graphscore`; **Tokens saved** = savings metric #4 (usage token savings). Two columns need data the catalog does not yet expose — **Graph size** (nodes·edges) and **Updated** (last build time): either (a) extend the catalog API with a small per-version `{nodes, edges, built_at}` (sourced from the pipeline build record) — tracked as a backend slice — or (b) drop those columns. Until present, they render `—`.
- **Honesty rule (from ticket 06):** show only values the data contains; missing → `—`; never fabricate. The export's illustrative numbers are placeholders.
- **Copy-command** is a pure builder: `{slug, version} → "npx docs-kg <slug>"` (append `@<version_label>` when a non-latest version is chosen). Copying triggers **no network request and no auth** (ADR-0005).
- The four hero **stat tiles** show a real representative doc (or an honestly-labelled aggregate), with the basis labelled — not fabricated.
- Reuse the **copy and structure** from the design export verbatim where static (headlines, section copy, step text); replace the illustrative dataset with live catalog data.

**Sign-in & consent (reuses backend)**
- "Sign in with GitHub" reuses **ticket 03's** OAuth exchange on the Worker; the client secret stays server-side and appears in no shipped asset (ADR-0001, grep/DevTools verifiable).
- The signup opt-in checkbox **ships unchecked** (no `checked` attribute); unticked → `marketing_consent = no`, ticked → `yes`; either stamps `consent_at` + a website `consent_source`. The opt-in renders **only while `marketing_consent` is `unset`** (ADR-0006). The landing page itself carries **no email/opt-in field** — capture lives only in the signup flow.

**Legal**
- Static, public **Privacy / Terms / attribution** pages, linked in the footer, no sign-in, no capture. Attribution lists each doc's `repo_url` + `license_id` from the catalog.

## Testing Decisions

- **What a good test is here:** assert external behavior, not markup. The page is mostly presentation; the real logic is the transform from catalog data + UI state to what the user sees, plus a few gate/consent behaviors the ADRs require. Don't test Tailwind classes or component internals.
- **The one seam — the catalog view-model module (pure):** input `(catalog API response, activeTab, searchQuery)` → output the exact rendered rows: name, repo, version, graphscore, `tokensSaved | —`, `graphSize | —`, `updated | —`, the command string, and honesty markers — already **sorted** (popular = score desc, smallest = nodes asc, recently built = built_at desc) and **filtered** by query. Unit-test this module against fixture catalog JSON: correct sort per tab, correct filter, correct `—` for every missing metric, correct command string (with/without `@version`). Components are thin renderers over this module and are not unit-tested beyond the behavior checks below.
- **Three thin behavior checks** (React Testing Library / DOM assertions), each pinning an ADR-critical acceptance criterion: (1) the landing page renders **no email/opt-in input** and copying the command fires **no fetch/auth** (ADR-0005); (2) the signup opt-in checkbox is **unchecked by default** and a submit without touching it yields `marketing_consent = no` (ADR-0006); (3) a catalog row missing a metric still renders, showing `—`.
- **Prior art:** `backend/src/catalog.test.ts` (11 vitest tests) — same runner/style. Frontend uses **vitest + React Testing Library**.
- Backend CORS + any catalog-extension (`nodes/edges/built_at`) slices get their own tests in the backend's existing vitest suite.

## Out of Scope

- Paid plans, MCP service, charging for the KG; Google sign-in; the CLI and backend internals (built elsewhere); the release poller; the graphify engine (ADR-0005, CONTEXT deferred list).
- The interactive `graph.html` preview embed (ticket 06 mentioned it) — defer unless trivially cheap; the table + copy-command carry v1.
- Product name/brand/domain finalization (`rnui.dev` unchosen) — the site ships under the placeholder "docs-kg".
- Real per-doc numbers for docs missing savings #2/#4 — those depend on the pipeline's savings pass (P2); the site shows `—` until they land.
- A light theme (Frame A is dark-committed; add later if wanted).

## Further Notes

- This spec realizes docs-kg-cli tickets **06/07/10**; when tickets are cut from it, they replace those placeholders' presentation. Keep the ADR acceptance criteria from 06/07/10 as the honesty/gate/consent guardrails.
- The design export holds all three directions (A/B/C) and a `<script>` with the real copy + an illustrative dataset + the exact sort logic (score / nodesNum / updatedHrs) — reuse that logic for the view-model, feed it live catalog data.
- Deployment host is flexible (Cloudflare Pages/Workers); it must reach the backend Worker's catalog API and be allowed by its CORS.
- shadcn components come from the shadcn MCP during the build.
