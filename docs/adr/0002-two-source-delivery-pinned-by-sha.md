# ADR-0002 — Two-source delivery, pinned by commit SHA

**Status:** Accepted (2026-07-20)

## Context
The product ships a doc's Markdown + a knowledge graph. Shipping the `.md` ourselves would make us the
redistributor of every doc's content (a licensing burden). Verified fact: the corpus `.md` is the **raw upstream
repo content, unmodified** — so the user can fetch it themselves from the source. But the corpus captured **no
commit SHA** (context7's own `sha` field is empty; only a `lastUpdate` date exists), so an upstream fetch
"today" would drift from whatever snapshot the KG was built on (e.g. zod's KG is v3-era; upstream is now v4).

## Decision
One command, **two sources**:
- **`.md`** fetched by the CLI from the **upstream public** repo, as a single anonymous **codeload tarball at a
  pinned commit SHA** (`codeload.github.com/{o}/{r}/tar.gz/{sha}`), extracting `docs/**`. No token; does not spend
  the 60/hr anonymous REST budget; ToS-clean.
- **KG** fetched from the maintainer's **private** repo via the backend broker (backend holds the token; streams
  bytes; user never holds a key).

Every KG is **built from, and recorded with, a specific `{repo, sha}`**. The build machine fetches the same
codeload tarball the CLI will, at that SHA, and graphifies *that* — so KG and `.md` align by construction.

## Consequences
- We never redistribute docs → the redistribution/licensing burden largely disappears; we only ever serve our
  own KG.
- The catalog contract **must** carry `{repo_url, sha, docs_path}` (absent today — a required addition).
- **Launch task:** re-graphify the existing 39 from freshly-pinned upstream HEADs so they gain a real SHA.
- A KG is immutably keyed by `(repo, sha)`; the `default` folder name is never an identity (see ADR-0003).
