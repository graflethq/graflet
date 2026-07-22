# P1 — [kg-pipeline] Re-graphify 39 from pinned HEADs + push private

> Separate **kg-pipeline** project, not this repo's code. Scheduled for the next day. Tracked here because it blocks tickets 02 and 05.

**What to build:** In the kg-pipeline project, re-run the graphify build for each of the ~39 docs currently marked `done`, sourcing each build from a freshly-pinned upstream commit. For each doc, pin the current HEAD of its upstream public repo to a real 40-char commit SHA, fetch that snapshot as a single anonymous codeload tarball (`codeload.github.com/{org}/{repo}/tar.gz/{sha}`, no token), extract the `docs_path` (`docs/**`) subtree, and graphify exactly that — the same fetch the CLI will later perform — so the KG and upstream `.md` align by construction (ADR-0002). Each rebuilt doc records the previously-absent `{repo_url, sha, docs_path}` so the catalog (ticket 02) can carry the immutable source pin. Each resulting KG is pruned from graphify's raw output down to the shippable bundle (graph.json, graph.html, GRAPH_REPORT.md, savings.json, LICENSE) and pushed to the maintainer's private repo, keyed by `(repo, sha)` — never by the moving `default`/`latest` label (ADR-0003).

**Blocked by:** None — can start immediately (kg-pipeline project, next day).

**Status:** ready-for-agent

- [ ] Each of the ~39 `done` docs has a recorded `{repo_url, sha, docs_path}` where `sha` is a real 40-char upstream commit SHA (not empty, not `main`) and `repo_url` is `github.com/{org}/{repo}` — verify by listing the triples, none with an empty/non-SHA `sha`.
- [ ] Each KG was graphified from the anonymous codeload tarball at the recorded SHA with `docs_path`'s `docs/**` extracted and no GitHub token — demoable by re-fetching that tarball and confirming its `docs/**` matches the graphified source.
- [ ] Each pushed bundle contains only the shippable core (graph.json, graph.html, GRAPH_REPORT.md, savings.json, LICENSE) — no `cache/`, `.graphify_*`, dated dirs, or internal manifests remain.
- [ ] Each bundle is stored in the private repo at a path keyed by `(repo, sha)`; no folder is named or relabeled `default`/`latest` (ADR-0003).
- [ ] All ~39 rebuilt bundles are present in the private repo — demoable by pulling it and finding one bundle per `done` doc.
