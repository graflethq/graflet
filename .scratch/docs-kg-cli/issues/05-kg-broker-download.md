# 05 — KG download broker + full `cli <slug>` download (SPINE)

**What to build:** THE SPINE. A signed-in user runs the CLI once for a single slug (`docs-kg <slug>`, or `<slug>@<version>`; `latest` by default) and gets both the doc's Markdown and its knowledge graph on disk together — the whole two-source delivery, and the one action that requires sign-in. The CLI resolves `{repo_url, sha, docs_path, kg_ref}` from the catalog (ticket 02), calls **ticket 04's fetch module** for the `.md` (anonymous codeload tarball at the pinned SHA — no rebuild of that logic here), and requests the KG bundle from the backend download broker. The broker — the Cloudflare Worker — verifies the caller's bearer token (issued by ticket 03), pulls the bundle from the maintainer's private repo using the server-side token, and streams the bytes straight back; the user never holds a GitHub key, no signed URL exists for private GitHub content, and the server-side token is never exposed. Because the KG was built from that same `{repo, sha}` (P1), the two sources land together and align by construction. Auth is enforced here and nowhere else — install, browse, copy-command and version listing stay signup-free.

**Blocked by:** 02 (resolve → `kg_ref`), 03 (bearer token to verify), 04 (the `.md` fetch module it composes), P1 (KG bundles must exist in the private repo).

**Status:** ready-for-agent

- [ ] Running the CLI for one slug while signed in writes BOTH the extracted `docs/**` Markdown and the KG bundle (graph.json, graph.html, GRAPH_REPORT.md, savings.json, LICENSE) to disk from a single command — there is no `.md`-only or KG-only path (ADR-0002).
- [ ] The `.md` is obtained by invoking ticket 04's fetch module (not a reimplementation), sending no GitHub token and not consuming the 60/hr anonymous REST budget.
- [ ] The download broker rejects any request lacking a valid caller bearer token (401/403) and serves the KG only to a verified caller; downloading the KG is the ONLY action requiring auth — `--help`, catalog browse and version listing all succeed unauthenticated (ADR-0005).
- [ ] On a valid token the broker fetches the KG from the private repo using the server-side token and streams the bytes in the response body — it never returns a signed/redirect URL and never exposes the server-side token to the client (ADR-0002).
- [ ] The SHA the CLI used for the codeload `.md` fetch equals the `sha` in the resolved catalog entry and the sha recorded with the delivered KG, demonstrating the graph matches the Markdown snapshot by construction (ADR-0002).
