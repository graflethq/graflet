// Env for docs-kg-backend. Hand-written for ticket 01 (no build step yet).
// Once a local .dev.vars exists you can regenerate this with `wrangler types`.
//
// Bindings live under Cloudflare.Env so that `env` from cloudflare:test — which
// resolves to Cloudflare.Env — is typed in tests too, and `Env` (used in
// src/index.ts) extends it.
declare namespace Cloudflare {
  interface Env {
    // D1 binding from wrangler.jsonc -> d1_databases[].binding
    CATALOG: D1Database;

    // Public var from wrangler.jsonc -> vars. Not a secret (it ends up in the
    // browser authorize URL); only the client SECRET below is a Worker secret.
    GITHUB_OAUTH_CLIENT_ID: string;

    // Secrets: set via `wrangler secret put` (prod) / .dev.vars (local). Never
    // in wrangler.jsonc; present on env as plain strings at runtime.
    PRIVATE_REPO_TOKEN: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
  }
}

interface Env extends Cloudflare.Env {}
