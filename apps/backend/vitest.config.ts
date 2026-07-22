import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Current API for @cloudflare/vitest-pool-workers >= 0.15 (Vitest 4): the
// `cloudflareTest()` Vite plugin. The old `defineWorkersConfig` /
// `@cloudflare/vitest-pool-workers/config` export was removed — do not use it.
// Tests run in workerd/Miniflare with no deploy and no Cloudflare account.
//
// readD1Migrations() runs in Node (config time); the migrations array is passed
// through as a binding and applied against CATALOG in test/apply-migrations.ts.
const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  test: { setupFiles: ["./src/test/apply-migrations.ts"] },
  plugins: [
    cloudflareTest({
      // Load the entry, compat date, and the CATALOG D1 binding from wrangler.jsonc.
      // Miniflare backs CATALOG with a local SQLite DB (database_id is ignored locally).
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Test-only values. The two secrets stand in for the production secrets
        // so the /ready presence check passes; the client_id mirrors the
        // wrangler.jsonc var. TEST_MIGRATIONS carries the schema to the setup file.
        bindings: {
          PRIVATE_REPO_TOKEN: "test-private-repo-token",
          GITHUB_OAUTH_CLIENT_SECRET: "test-oauth-client-secret",
          GITHUB_OAUTH_CLIENT_ID: "test-oauth-client-id",
          CATALOG_UPSERT_SECRET: "test-catalog-upsert-secret",
          RESEND_API_KEY: "test-resend-key",
          RESEND_FROM: "graflet <updates@test.dev>",
          MARKETING_POSTAL_ADDRESS: "123 Test St, Testville",
          UNSUBSCRIBE_SECRET: "test-unsubscribe-secret",
          PRIVATE_KG_REPO: "graflethq/kg-bundles",
          // Allow-list the CORS test asserts against (site origin + local dev).
          SITE_ORIGINS: "https://site.test,http://localhost:3000",
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
});
