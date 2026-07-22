# ADR-0008 — Repository layout: `apps/` + `packages/`

**Status:** Accepted (2026-07-22)

## Context
The repo grew organically with top-level `web/`, `backend/`, `cli/`, plus a `packages/` folder that
held only the npm/PyPI publish stubs. That mixed two kinds of thing at the root — **deployables**
(the site, the Worker) and **publishables** (the CLI, the registry stubs) — with no signal about which
was which. It also made the agent skills (`/to-spec`, `/to-tickets`, `/implement`) guess where code
for a given feature lives.

Each project is self-contained (its own `package.json`, `node_modules`, `pnpm-lock.yaml`); there is no
root pnpm workspace linking them. Verified before moving: no `tsconfig` `extends` across dirs, no `../`
path escapes in wrangler/next configs, no cross-dir imports — so relocating is a pure `git mv`.

## Decision
Adopt the conventional monorepo split:

- `apps/` — **deployables**: `apps/web` (Next.js/OpenNext on Cloudflare), `apps/backend` (Cloudflare Worker).
- `packages/` — **publishables**: `packages/cli` (the real `graflet` CLI), plus the existing
  `packages/graflet-npm` and `packages/graflet-pypi` publish stubs (unchanged).

The publish stubs stay in place so the OIDC release CI (`.github/workflows/publish.yml`, pinned to
`packages/graflet-npm` + `packages/graflet-pypi`) is unaffected. Moves done with `git mv` to preserve
history; all three dirs typecheck clean post-move (`tsc --noEmit` exit 0).

Deliberately **not** done: unifying into a single root pnpm workspace. The dirs are independent today;
unifying is a separate, larger change to make only if shared tooling/deps justify it.

## Consequences
- `CLAUDE.md` carries a repo-layout map so agent skills route: CLI → `packages/cli`, site → `apps/web`,
  API → `apps/backend`; specs/tickets → `.scratch/<feature>/`.
- When the real CLI is ready to publish, fold `packages/graflet-npm` into `packages/cli` (one package,
  not a stub plus a real one) and point the npm publish job at it.
- Local dev paths changed (`cd apps/web`, etc.); `.next` / `.wrangler` / `.open-next` build caches
  regenerate on next build.
