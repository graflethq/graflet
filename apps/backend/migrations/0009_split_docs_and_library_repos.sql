-- ADR-0011 — a doc is pinned by its DOCS repo; the library repo is metadata.
--
-- `docs.repo_url` and `doc_versions.sha` keep their meaning but now always name the repo the
-- documentation lives in (Effect's docs are `Effect-TS/website`, Tauri's are `tauri-apps/tauri-docs`).
-- That repo is what the CLI codeloads and what /attribution must credit, so it stays the pin.
--
-- code_repo_url: the library the docs describe. Display only — nothing fetches it. The catalog card
--   shows it ("PostHog/posthog.com" on a card reads as a mistake); /attribution keeps showing repo_url,
--   which is where the bytes actually come from. NULL on a same-repo doc, where the two coincide.
--
-- docs_exclude: JSON array of repo-relative prefixes inside `docs_path` the KG was NOT built from.
--   Per VERSION, because it is frozen with the {sha, docs_path} pin. Tauri's English docs are not a
--   subdirectory — the translation dirs are siblings of the English content — so the excluded paths
--   have to be named. The CLI applies the same list when it downloads the markdown (md-fetch.ts),
--   or the KG and the .md stop describing the same file set (ADR-0002).
ALTER TABLE docs ADD COLUMN code_repo_url TEXT;
ALTER TABLE doc_versions ADD COLUMN docs_exclude TEXT;
