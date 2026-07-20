import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Current API for @cloudflare/vitest-pool-workers >= 0.15 (Vitest 4): the
// `cloudflareTest()` Vite plugin. The old `defineWorkersConfig` /
// `@cloudflare/vitest-pool-workers/config` export was removed — do not use it.
// Tests run in workerd/Miniflare with no deploy and no Cloudflare account.
export default defineConfig({
  plugins: [
    cloudflareTest({
      // Load the entry, compat date, and the CATALOG D1 binding from wrangler.jsonc.
      // Miniflare backs CATALOG with a local SQLite DB (database_id is ignored locally).
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Test-only secret values — never real. These stand in for the two
        // production secrets so the /ready presence check and env test pass.
        bindings: {
          PRIVATE_REPO_TOKEN: "test-private-repo-token",
          GITHUB_OAUTH_CLIENT_SECRET: "test-oauth-client-secret",
        },
      },
    }),
  ],
});
