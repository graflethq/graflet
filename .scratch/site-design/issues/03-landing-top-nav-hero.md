# 03 — Landing top: nav + hero + terminal + copy-command

**What to build:** A visitor opening the site sees the themed sticky nav (wordmark, Catalog/Docs/GitHub links, "★ Star" and "Sign in with GitHub" buttons) and the hero: the FREE · OPEN SOURCE · MIT badge, the headline + subhead, the command pill `uvx graflet react` with a working Copy button, the primary and "Star on GitHub" CTAs, and the static illustrative terminal panel. Copying the command triggers no network request and no auth. The command string comes from a pure builder shared with the catalog table.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The sticky nav renders the wordmark, the three links, and the Star + Sign-in buttons (shadcn Button), themed dark, with no horizontal overflow on mobile.
- [ ] The hero renders the badge, headline, subhead, command pill, and both CTAs; the terminal panel shows the illustrative sample output, labelled as an example.
- [ ] The Copy button copies the exact command and fires NO network request and NO auth call (ADR-0005).
- [ ] The command builder is a pure function returning `uvx graflet <slug>` (with `@<version_label>` when a non-latest version is chosen) and is unit-tested (vitest).
- [ ] No email or marketing opt-in field appears anywhere on the landing page (ADR-0005).
