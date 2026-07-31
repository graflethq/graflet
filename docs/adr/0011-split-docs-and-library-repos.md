# ADR-0011 — A doc is pinned by its docs repo; the library repo is metadata

**Status:** Accepted (2026-07-29)

## Context
[ADR-0002] assumed one repo per doc: the CLI codeloads `{repo, sha}` and graphify built the KG from that same
pin, so the two halves align by construction. Several high-value docs break that assumption — the documentation
lives in a *different* repo from the library. Effect's docs are `Effect-TS/website`, not `Effect-TS/effect`;
Tauri's are `tauri-apps/tauri-docs`; Langfuse's are `langfuse/langfuse-docs`; Supabase Auth's are inside
`supabase/supabase`. Pointing the pipeline at the library repo produced knowledge graphs built from per-crate
READMEs, changelogs and `.changeset` entries — `tauri` graded 19.4/100 that way, and `langfuse-python` has
exactly seven text files in its entire repo.

The catalog carried one `repo_url`, one `sha` and one `docs_path`, and `backfill_refs.py` resolved a
`version_label` to a git tag **in that same repo** — the tag `v3` exists in `Effect-TS/effect` and not in
`Effect-TS/website`.

## Decision
**`sha` always pins the docs repo** — the repo the CLI codeloads and graphify built from. [ADR-0002]'s alignment
guarantee and the `{org}__{repo}__{sha}` bundle key are unchanged; they simply now name the docs repo. The
library becomes metadata in two new nullable fields, `code_repo_url` + `code_ref`, that nothing fetches.

Four consequences follow, each decided against a real alternative:

- **Versions.** A new `docs_ref_mode` (`branch` | `dir` | `floating`, NULL = same-repo) says how the docs repo
  carries versions, because the three real shapes cannot be told apart automatically. The rejected alternative —
  always pin the docs repo's HEAD — would make old versions unbuildable, breaking [ADR-0003]'s "keep old
  versions" for exactly the docs that need it most.
- **Licence.** `license_id` describes what governs the **`docs_path` subtree of the docs repo**, operator-set,
  with a `license_scope` of `repo` or `path`. Repo-level SPDX is not sufficient: PostHog's LICENSE forbids reuse
  of the site but grants verbatim MIT over `/contents/`, which GitHub reports as `NOASSERTION`. A docs repo that
  states **no** licence is still shippable — see [ADR-0012] for why and what the bundle carries instead.
- **Display.** `/attribution` shows the **docs repo** (it names the source of the bytes we send users at, and
  must be accurate); the catalog card shows the **library** via `code_repo_url` (it is product surface, and
  "PostHog/posthog.com" on a card reads as a mistake).
- **Sub-paths.** `docs_path` stays a single string; a nullable `docs_exclude` list prunes parts of it. Tauri's
  English docs are not a subdirectory — the 360 translation files under `ja`/`zh-cn`/`ko`/… are what must be
  named. The exclude list is applied in `fetch.py` **and** `md-fetch.ts`, or the KG and the markdown diverge.

## Consequences
- A repoint can widen a doc past its name. `posthog-js` → whole-product PostHog docs and `langfuse-python` →
  whole-product Langfuse docs are therefore renamed to `posthog` and `langfuse`. No alias table: the catalog had
  0 subscriptions and no published artefact printed either command.
- **GraphScore is not the acceptance test for a `docs_path` pin.** It samples edges and files and has an LLM
  judge faithfulness and coverage, so a narrow, dense doc set can score *below* a wide one padded with READMEs —
  react.dev fell 84.9 → 79.6 and axum 93.0 → 85.5 on correctly-scoped rebuilds. Correct scope wins anyway,
  because the pin also fixes the markdown the CLI hands the user: a NULL `docs_path` ships the user changelogs
  and test fixtures (`md-fetch.ts` mirrors the same repo-wide rule).
- `backfill_refs.py` must branch on `docs_ref_mode` instead of assuming a tag in the pinned repo.
- The poller ([ADR-0004]) watches the **library** for releases but queues a build against the **docs** repo.

[ADR-0002]: 0002-two-source-delivery-pinned-by-sha.md
[ADR-0003]: 0003-version-as-document-identity.md
[ADR-0004]: 0004-three-box-infrastructure.md
[ADR-0012]: 0012-bundle-carries-no-source-text.md
