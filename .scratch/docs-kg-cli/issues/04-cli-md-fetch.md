# 04 — CLI md-fetch module (codeload at pinned sha)

**What to build:** An internal Markdown-fetch module that ticket 05 composes into the single user-facing download — **not** a standalone `.md`-only user command (ADR-0002 forbids a `.md`-only or KG-only path; the only user download is the two-source command in 05). Given a `{repo_url, sha, docs_path}` resolved from the catalog (ticket 02), the module downloads one anonymous codeload tarball of the upstream public repo pinned at that immutable commit SHA (`codeload.github.com/{org}/{repo}/tar.gz/{sha}`), strips the tarball's top-level `{repo}-{sha}/` prefix, extracts only the `docs_path` subtree, and returns/writes the `.md` byte-for-byte as it exists upstream at that SHA. No GitHub token and no `api.github.com` call, so it never spends the 60/hr anonymous REST budget (ADR-0002). Because it pins the same SHA the KG was built from (P1), the Markdown aligns with the KG once ticket 05 wires them together.

**Blocked by:** 02 (needs the catalog resolve for `{repo_url, sha, docs_path}`).

**Status:** ready-for-agent

- [ ] Given a catalog-resolved `{repo_url, sha, docs_path}`, the module fetches via a single anonymous request to `codeload.github.com/{org}/{repo}/tar.gz/{sha}`; it makes no request to `api.github.com` and sends no token (verify: request log / no auth header).
- [ ] Only the `docs_path` subtree is extracted (top-level `{repo}-{sha}/` prefix stripped) and written under a predictable local path — other repo content is not written.
- [ ] The returned/written `.md` bytes match the upstream repo content at that SHA exactly (unmodified).
- [ ] The module is driven by a catalog-resolved triple, not hard-coded values; an unresolvable/unknown input fails cleanly (not-found) rather than attempting a download.
- [ ] The module is exercised by a function/integration-level test — it is NOT wired as a user-facing `.md`-only command (the only user download is the two-source command in ticket 05, ADR-0002).
