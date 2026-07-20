# 04 — CLI md-fetch module (codeload at pinned sha)

**What to build:** An internal Markdown-fetch module that ticket 05 composes into the single user-facing download — **not** a standalone `.md`-only user command (ADR-0002 forbids a `.md`-only or KG-only path; the only user download is the two-source command in 05). Given a `{repo_url, sha, docs_path}` resolved from the catalog (ticket 02), the module downloads one anonymous codeload tarball of the upstream public repo pinned at that immutable commit SHA (`codeload.github.com/{org}/{repo}/tar.gz/{sha}`), strips the tarball's top-level `{repo}-{sha}/` prefix, extracts only the `docs_path` subtree, and returns/writes the `.md` byte-for-byte as it exists upstream at that SHA. No GitHub token and no `api.github.com` call, so it never spends the 60/hr anonymous REST budget (ADR-0002). Because it pins the same SHA the KG was built from (P1), the Markdown aligns with the KG once ticket 05 wires them together.

**Blocked by:** 02 (needs the catalog resolve for `{repo_url, sha, docs_path}`).

**Status:** done 2026-07-20 — `cli/src/md-fetch.ts` (internal module; gunzip via Node `zlib` + a small in-process pax/ustar tar reader, zero runtime deps). 7 tests in `md-fetch.test.ts`; verified end-to-end against a real codeload tarball (github/gitignore `Global/`, 76 files byte-identical to `bsdtar`).

Original acceptance criteria (verbatim), all met:

- [x] Given a catalog-resolved `{repo_url, sha, docs_path}`, the module fetches via a single anonymous request to `codeload.github.com/{org}/{repo}/tar.gz/{sha}`; it makes no request to `api.github.com` and sends no token (verify: request log / no auth header). *(bare GET, no headers; tested + integration-verified.)*
- [x] Only the `docs_path` subtree is extracted (top-level `{repo}-{sha}/` prefix stripped) and written under a predictable local path — other repo content is not written. *(written under `destDir/{docs_path}/…`; root README skipped.)*
- [x] The returned/written `.md` bytes match the upstream repo content at that SHA exactly (unmodified). *(hash-checked against `bsdtar`.)*
- [x] The module is driven by a catalog-resolved triple, not hard-coded values; an unresolvable/unknown input fails cleanly (not-found) rather than attempting a download. *(throws before any network; `fetchImpl` asserted not called.)*
- [x] The module is exercised by a function/integration-level test — it is NOT wired as a user-facing `.md`-only command (the only user download is the two-source command in ticket 05, ADR-0002).

Additional hardening added during build (beyond the 5 criteria, not part of the original contract):
- Rejects a non-40-char `sha` (e.g. `main`/a branch ref) — upholds ADR-0002 "pinned by commit SHA".
- Refuses archive entries that resolve outside `destDir` (path-traversal / zip-slip guard on disk extraction).
- pax records parsed over bytes (multibyte paths) + a corrupt-size guard in the tar reader.
