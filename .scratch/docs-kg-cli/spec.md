# Spec — Docs-KG CLI, v1

**Status:** broken into tickets → `issues/` (see `issues/00-INDEX.md` for the DAG + frontier). Work the frontier with `/implement`, fresh context per ticket.
**Context:** `../../CONTEXT.md` + `../../docs/adr/`. Read those first; this is the build plan only.
**Goal of v1:** ship the free OSS CLI + the site + the backend + the daily poller, launch on the ~39 ready
docs, and start growing an audience (email list + GitHub stars + donations).

**Launch corpus pool:** `research/context7-legality/programming-docs.db` → table `programming_docs` (50,218
green-license, popularity-ranked, programming-only libs) is the first-release target pool. The shippable-now set
is still the ~39 already graphified; the 50,218 is the ordered queue to graphify from (popularity-first). The
non-programming remainder of the 106k is deferred, not dropped.

---

## Components & scope

### 1. CLI (open source, its own public repo)
- `docs-kg <slug>` (name TBD) — the core command. Resolves the doc+version from the catalog API, signs the user
  in with GitHub if needed, fetches `.md` from upstream (codeload tarball at the pinned SHA → extract `docs/**`)
  and the KG from the backend, writes both locally.
- `docs-kg login` / `logout` — GitHub OAuth (device/browser flow); token stored in the OS keyring with a
  plaintext fallback (the gh/supabase pattern). A `--token`/env-var path for CI.
- `docs-kg watch <slug>` — subscribe to a doc's updates; at this step, prompt for the marketing opt-in **only if
  consent is unset** (ADR-0006).
- `docs-kg <slug>@<version>` — pick a specific version; default = `latest`.
- Auth is required **only** for the download/watch; `--help` and version listing are free (ADR-0005).
- No `.md`-only or KG-only path — one download, two sources under the hood (ADR-0002).

### 2. Backend (Cloudflare Worker — ADR-0004)
- **GitHub OAuth**: exchange, verify identity, upsert the user row, issue the CLI a bearer token.
- **Catalog API**: read-only endpoints the site + CLI consume (list docs, doc detail with versions + savings,
  resolve `{slug,version} → {repo, sha, docs_path, kg_ref}`).
- **Download broker**: verify the caller, fetch the KG from the private repo with the server-side token, **stream
  the bytes** (no signed URL exists for private GitHub content).
- **Catalog store**: KV/D1, mirror of the public catalog subset; updated by the pipeline's status POSTs.
- **Email trigger**: on a doc going `ready`, email its watchers via Resend (service email; promo footer only for
  `marketing_consent = yes`).
- `/catalog/upsert` (shared-secret) — the endpoint the pipeline + poller POST status to.

### 3. Website
- Landing page: the **savings hero** — per-doc rows (name, license, popularity, one hero savings number) + a
  catalog-total header, honestly labeled. Progressive-disclosure rows (expand → full metrics + `graph.html`
  preview + copy-command). *Design when built; `dataviz` + `artifact-design` skills.*
- Signup (GitHub OAuth) with the **unchecked** marketing opt-in (ADR-0006).
- Copy-the-command with **no signup** required.
- Minimal Terms/Privacy/attribution page (collects emails + serves KGs).
- Host: Cloudflare Pages / Vercel, or the VPS behind Traefik — decide at build.

### 4. Poller (VPS — ADR-0004)
- Daily, per doc: authenticated conditional GET of latest release/tag (ETag; `releases/latest`, fall back to
  `/tags` for tag-only repos). Serial/throttled for secondary limits.
- New tag → filter via `version-resolution.jsonl` (skip pre-releases; only a real new axis-level version) →
  **re-check the license** → enqueue a **priority** build → Telegram-ping the operator.
- Resumable (store `{etag, last_seen_tag}` + a cursor). Cap build fan-out; order by popularity.
- Built with n8n/cronicle.

### 5. Pipeline changes (separate project — contract only here)
- Record `{repo_url, sha, docs_path}` per build; build from the codeload tarball at that SHA.
- Prune bundles to the shippable core; push to the private repo.
- POST status (`graphifying` / `ready` + savings + graphscore + sha + license) to `/catalog/upsert`.
- Finish savings metrics **#2 (build-time)** and **#4 (usage token savings)** in the `graphify-and-score` skill.

---

## Pre-launch checklist (blocking)
1. Re-graphify the **39** from freshly-pinned upstream HEADs → real `{repo, sha}` each (ADR-0002).
2. Extend the catalog (`programming_docs`) with `{repo_url, sha, docs_path, version_label, is_latest}`.
   - `repo_url` = derive `github.com/{org}/{repo}` (columns present) — free now.
   - `version_label` / `is_latest` / `default_represents` = join `version-resolution.jsonl` by project — free now.
   - `needs_human` = join the `libraries` table (already in `programming-docs.db`) — free now.
   - `sha` + `docs_path` = **not in any db**; captured at graphify time (couples to #1). `sha` from the pinned
     HEAD, `docs_path` = which subdir holds the `.md`.
3. Prune the 39 bundles; push to the private repo.
4. Finish savings #2/#4 (needed only if leading the landing page with savings — recommended).
5. Review the **94** `needs_human` version rows in the programming-docs launch corpus (`programming_docs`). (The earlier "110" was the low-confidence count across the full 106k `version-resolution.jsonl`; the non-programming remainder is deferred.)

## Explicitly out of v1
Paid plans / MCP / KG charging; Google sign-in; incremental `graphify update`; the graphify engine itself;
product name/brand/domain (open); combined multi-doc mega-graphs; auto-refresh beyond release-triggered builds.

## Open questions (not blocking the build, decide along the way)
- Product name + brand + domain (`rnui.dev` available but unchosen).
- Website host (Pages/Vercel/VPS).
- CLI language/distribution (npm `npx`? a single binary?) — pick for lowest install friction.
- Exact hero savings number to lead with (tokens-to-build reads bigger than the small $ for most docs).
