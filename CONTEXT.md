# CONTEXT — Docs-KG CLI (working name TBD)

**Last updated:** 2026-07-20
**Status:** design settled via grilling; not yet built.
**Supersedes:** the web-app product mapped in `.scratch/docs-kg-service/` (that map's delivery half is retired; see ADRs).

This file is the single source of truth for *what the product is and why*. Hard-to-reverse decisions
have their own ADR under `docs/adr/`. The build plan is `.scratch/docs-kg-cli/spec.md`.

---

## What it is (one paragraph)

A **free, open-source command-line tool** that downloads a documentation's Markdown **and** a pre-built
**knowledge graph** of it. A website lets people browse the catalog and copy the command. The tool's whole
point is the knowledge graph; the Markdown it fetches itself from the docs' own public GitHub repo. The KG
lives in a private repo and is handed out through a small backend after the user signs in with GitHub. There
are **no paid plans in v1** — the goal right now is **audience, GitHub stars, and donations**, with paid
offerings (an MCP service, or charging for the KG) deferred to later.

---

## Ubiquitous language (glossary)

- **Documentation / doc** — one software project's docs (e.g. React, Next.js). Identified by its GitHub repo.
- **Knowledge graph (KG)** — graphify's output for one doc snapshot: `graph.json` + `graph.html` +
  `GRAPH_REPORT.md` + `savings.json`. The product's real value.
- **Bundle** — the shippable core of a KG (the four files above + `LICENSE`), pruned of graphify's internal
  working files (`cache/`, `.graphify_*`, dated dirs, internal `manifest.json`).
- **Two-source delivery** — one CLI command fetches from **two** places: the `.md` from the doc's **upstream
  public** GitHub repo (unmodified, at a pinned commit), and the **KG** from the maintainer's **private** repo
  via the backend. The user sees one download but holds no GitHub key. See [ADR-0002].
- **The gate** — the single action that requires sign-in: downloading a KG. Everything else (install, browse,
  copy the command, star the repo) is free. See [ADR-0005].
- **Version / release** — a new edition of a doc's content, tied to a project **release** (not the `main`
  branch). Each tracked version = one immutable KG. See [ADR-0003].
- **`default`** — the moving pointer to a doc's newest snapshot (from the context7 corpus). A **label, never an
  identity** — a KG is keyed by `(repo, commit SHA)`, never by the folder named `default`.
- **Release axis** — the semver component that separates two *documents* for a given project: the most-
  significant component that moves across its stable releases (major for Next.js, minor for React Native).
  Auto-detected per project. See [ADR-0003].
- **Version playbook** — `research/context7-legality/version-resolution.jsonl`: per-library scheme, release
  axis, stable `site_versions`, pre-release markers to ignore, and what `default` currently represents.
- **Catalog** — the list of docs + their versions + metadata the site and CLI read. Spine =
  `kg-pipeline/manifest.jsonl`, extended with `sha`, `version_label`, `is_latest`.
- **The poller** — a daily job that checks each doc's GitHub for a new release and, if found, queues a build
  and pings the operator. See [ADR-0004].
- **Watch / notification** — a user subscribes to a doc; when its KG is (re)built they get an **email**.
- **Savings metrics** — the four quantified numbers shown per doc (build-cost, build-time, GraphScore, usage
  token savings) that sell the value. Spec: `research/savings-metrics/REQUIREMENTS.md`.
- **Operator** — you. Operator alerts go to **Telegram**; user alerts go to **email**. Never confused.

---

## Key decisions (index → ADRs)

| # | Decision | ADR |
|---|----------|-----|
| Identity = **GitHub OAuth** (not Google) — dev-native, real dev email, one click from a star | [ADR-0001] |
| **Two-source delivery**, KG-from-private-repo brokered, `.md` from upstream **pinned by commit SHA** | [ADR-0002] |
| **Version = document identity** via per-project release axis; **release-bound, one full build per version**, no incremental update; keep old versions | [ADR-0003] |
| **Three-box infrastructure**: Cloudflare backend / VPS poller / build machine — each on the infra its needs demand | [ADR-0004] |
| **Gate only the KG download**; free + OSS; monetization deferred; goal = audience + stars + donations | [ADR-0005] |
| **Consent model**: unchecked opt-in, two capture points, transactional/service/marketing email split | [ADR-0006] |

---

## Architecture — three boxes, each where it belongs

```
Cloudflare Worker  ── the always-up backend ───────────────────────────
   • GitHub OAuth login          • catalog API (reads catalog store)
   • download broker (holds the private-repo token; streams KG bytes)
   • triggers subscriber emails (via Resend)
   Why here: must be always-up + global; the 50-subrequest/invocation
   limit never applies to normal per-request work (each does ~1–3 calls).

VPS (AlexHost, always-on-ish)  ── the daily poller ONLY ───────────────
   • once/day, checks every doc's GitHub for a new release
   • authenticated + conditional (ETag) requests → unchanged = free
   • filters via the version playbook → queues a priority build
   • pings the operator on Telegram (found / ready)
   Why here: background job, tolerates the VPS's occasional maintenance
   downtime (a missed run is harmless); avoids Cloudflare's 50-limit; free.
   Tools already present: n8n / cronicle.

Mac / rented box  ── graphify builds ONLY ────────────────────────────
   • runs graphify per release at a pinned SHA → produces the KG
   • pushes the pruned bundle to the private repo
   • POSTs status to the backend (→ site updates + subscriber emails)
   Why here: needs real CPU/RAM the 2-shared-core VPS can't give.
```

- **Storage:** KGs are small → the private GitHub repo. The full docs corpus (tens of GB) lives on the build
  machine only; it is **never** shipped or hosted — the CLI fetches `.md` from upstream.
- **Email (users):** Resend (verified domain, one-click unsubscribe on marketing mail).
- **Donations:** GitHub Sponsors (primary, 0% on personal sponsorships) + Buy Me a Coffee (fallback).

---

## The delivery flow (what one command does)

1. User copies the command from the site (no signup to copy).
2. Runs it → CLI signs them in with **GitHub** (browser handoff; backend holds the OAuth secret).
3. CLI resolves the doc + version from the catalog → gets `{upstream repo, commit SHA, docs path, KG ref}`.
4. Fetches the `.md` from **upstream** via one anonymous codeload tarball at the SHA (no GitHub token needed;
   does not touch the 60/hr anonymous REST limit) and extracts `docs/**`.
5. Fetches the **KG** from the backend, which verifies the GitHub identity and streams the bytes from the
   private repo (user never sees the maintainer's token).
6. Both land together locally. KG and `.md` align because the KG was built from that same pinned SHA.

---

## Data model

**Catalog entry** (spine = `kg-pipeline/manifest.jsonl`, extended):

| field | source | note |
|-------|--------|------|
| `slug`, `name` | manifest | display |
| `repo_url`, `sha`, `docs_path` | **pipeline (new)** | the exact upstream source to fetch; SHA is the immutable pin |
| `kg_ref` | pipeline | location in the private repo |
| `version_label`, `is_latest` | version playbook | e.g. "16"; `default`/latest is an alias |
| `savings` (`savings.json`), `graphscore` | pipeline | the four wedge metrics |
| `status` | manifest | `ready` / `graphifying` |
| `license_id` | manifest | re-checked on every new version |
| `rank` (popularity) | manifest | default sort |

**User** — `{github_id, email, created_at, marketing_consent (unset/yes/no), consent_at, consent_source}`.
The users table **is the core asset** of the project. See [ADR-0006].

**Subscription** — `{user, doc}` — who watches which doc, for update emails.

---

## Current state (launch readiness)

- **~39 docs `done`** in `manifest.jsonl` (74 finished on disk) — strong recognizable names (next.js, react.dev,
  shadcn-ui, fastapi, prisma, playwright, vitest, laravel, django, zod, supabase…), all green licenses.
- **Version playbook built** (`version-resolution.jsonl`, 106,370 libs; 223 multi-version; 110 need review).
- **Savings data partial:** `savings.json` has build-cost (metric #1) for recent builds; GraphScore on ~8;
  build-time (#2) and usage-savings (#4) **not yet computed** — extend the `graphify-and-score` skill's savings
  pass. The strongest number (#4) is missing, so finish it before making savings the hero.
- **Not yet built:** the CLI, the website, the backend, the poller. All greenfield.

### Must-do before/at launch
1. **Re-graphify the 39** from freshly-pinned upstream HEADs so each KG has a real `{repo, sha}` and the CLI's
   upstream fetch aligns. ([ADR-0002])
2. **Add `{repo_url, sha, docs_path}`** to the catalog contract (absent today).
3. **Prune bundles** to the shippable core before shipping.
4. **Finish savings metrics #2 and #4** if leading the landing page with savings.

---

## Success metric (v1)

Not revenue. **Audience (consented email list) + GitHub stars + donations.** Monetization is a phase-2
decision after there's an audience. (Replaces the old map's "100 signups / paywall a subset.")

## Deferred / out of scope

- Paid plans, MCP service, charging for the KG — **future**, not v1.
- The graphify engine + `kg-pipeline` batch scripts — a **separate** project; not shipped with this repo.
- Google sign-in — rejected in favour of GitHub ([ADR-0001]).
- Incremental `graphify update` / `main`-branch tracking — deleted; release-bound full builds only ([ADR-0003]).
- Product name, brand, domain — **open**. (`rnui.dev` is available but unchosen.)
- Concrete price points / which KGs ever get paywalled — phase-2.

[ADR-0001]: docs/adr/0001-github-oauth-identity.md
[ADR-0002]: docs/adr/0002-two-source-delivery-pinned-by-sha.md
[ADR-0003]: docs/adr/0003-version-as-document-identity.md
[ADR-0004]: docs/adr/0004-three-box-infrastructure.md
[ADR-0005]: docs/adr/0005-gate-and-free-oss-model.md
[ADR-0006]: docs/adr/0006-consent-and-audience-model.md
