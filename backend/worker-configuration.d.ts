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

    // Public vars from wrangler.jsonc -> vars. Not secrets (the client_id ends up
    // in the browser authorize URL; the others are just config).
    GITHUB_OAUTH_CLIENT_ID: string;
    // Verified Resend sender + the postal address shown in promo email footers (ticket 08).
    RESEND_FROM: string;
    MARKETING_POSTAL_ADDRESS: string;
    // `{owner}/{repo}` of the private repo holding the KG bundles (ticket 05). Not a
    // secret (only the token that reads it is); the broker fetches `{kg_ref}.tar.gz` from it.
    PRIVATE_KG_REPO: string;

    // Secrets: set via `wrangler secret put` (prod) / .dev.vars (local). Never
    // in wrangler.jsonc; present on env as plain strings at runtime.
    PRIVATE_REPO_TOKEN: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
    // Shared secret the pipeline + poller present to POST /catalog/upsert (ticket 02).
    CATALOG_UPSERT_SECRET: string;
    // Resend API key for watcher email; signing secret for one-click unsubscribe
    // tokens (SHA-256 of `unsub:<id>:<secret>`, secret last) (ticket 08).
    RESEND_API_KEY: string;
    UNSUBSCRIBE_SECRET: string;
  }
}

interface Env extends Cloudflare.Env {}
