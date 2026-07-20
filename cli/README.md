# docs-kg CLI

The open-source command-line tool for the docs-KG project. It signs you in with
GitHub and (later tickets) downloads a doc's Markdown + knowledge graph.

**Name is provisional** (`docs-kg`, package `docs-kg-cli`) — the brand is still
open (CONTEXT.md). **Ticket 03 (this):** `login` / `logout` only. Download (05)
and `watch` (08) come later.

## Commands

| Command | What it does |
|---------|--------------|
| `docs-kg login` | GitHub OAuth in the browser; on success stores a bearer token. |
| `docs-kg logout` | Forgets the stored token (keyring + plaintext fallback). |
| `docs-kg --help` | Usage. Runs signed-out — auth gates only the KG download (ADR-0005). |

Sign-in is **identity only** — it never asks for marketing consent (ADR-0006).

## How auth works

The CLI never holds the GitHub client secret. It calls the backend, which runs
the OAuth code exchange and mints its own bearer token (ADR-0001):

```
docs-kg login
  → POST  <api>/auth/cli/start   → { authorize_url, state }
  → opens authorize_url in the browser; you approve on GitHub
  → GitHub redirects to the backend callback, which exchanges the code
  → POST  <api>/auth/cli/poll {state}  (repeated) → { token, login }
  → token stored in the OS keyring (or a 0600 file where none exists)
```

## Token storage

1. **OS keyring** (`@napi-rs/keyring`) — the default.
2. **`~/.config/docs-kg/token`** (0600) — fallback where no keyring exists
   (headless Linux, containers). Honors `XDG_CONFIG_HOME`.

For CI / headless use, skip the browser entirely with a token you already hold:

```sh
export DOCS_KG_TOKEN=<bearer>      # or pass --token to the download/watch commands
```

`DOCS_KG_TOKEN` / `--token` authenticate **without** a browser and **without**
writing the keyring.

## Config

| Env | Purpose | Default |
|-----|---------|---------|
| `DOCS_KG_API` | Backend base URL | placeholder until the Worker URL is pinned |
| `DOCS_KG_TOKEN` | Use this bearer directly | — |
| `XDG_CONFIG_HOME` | Base dir for the plaintext fallback | `~/.config` |

## Develop

```sh
pnpm install
pnpm run typecheck
pnpm test          # vitest (Node) — credential store + login flow, no network
pnpm run build     # tsc → dist/ ; the bin is dist/index.js
```
