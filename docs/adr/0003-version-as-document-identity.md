# ADR-0003 — Version = document identity; release-bound builds; keep old versions

**Status:** Accepted (2026-07-20)

## Context
`graphify --update` keys nodes by file **path** and diffs a saved manifest — it has **no notion of version**. So
if the `default` folder's content silently rolls from v15 to v16, an incremental update would morph the v15
graph into v16 **in place**, destroying the v15 snapshot and producing a degraded, mis-provenanced graph. Also,
"how many files changed" is the wrong signal for *document identity*: a major bump with few changes is still a
new document (v15→v16), while a patch with many changes is still the same document (16.0.3→16.0.7). Projects
disagree on what "major/minor" means (Next.js moves its major; React Native is stuck at `0.x` and moves its
minor).

## Decision
Separate two questions:
- **Document identity → the VERSION decides, not the file count.** Each project has a **release axis** = the
  most-significant semver component that actually moves across its stable releases (auto-detected, stored in
  `version-resolution.jsonl`). Snapshots differing **at/above** the axis are **different documents**; differing
  only below it are the **same** document.
- **Build strategy → release-bound, one full build per version.** We track **releases**, never the `main`
  branch. Every tracked version gets **one full graphify**. **No incremental `graphify update`** (this deletes
  the corruption mode entirely).

A KG is keyed by `(repo, sha)` and frozen forever. `default`/`latest` is a **moving alias**. When `default`
rolls to a new version, we **relabel nothing** — the old KG stays frozen with its own label; the new release is
built as a new frozen KG and becomes `latest`. **Old versions' KGs are kept and remain downloadable.**

## Consequences
- Pre-release/junk tags (`rc`, `canary`, `beta`, `__branch__…`) are excluded via the playbook.
- The poller (ADR-0004) drives new builds off **release detection**, not folder watching.
- Patch-level doc freshness within a version line is intentionally ignored (a version is built once, at whatever
  patch is current when built, until the next axis-level release).
- The `default_represents` field is a one-time bootstrap label for already-built KGs, not a live pointer.
