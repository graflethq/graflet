import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

// Apply the D1 migrations (loaded in vitest.config.ts via readD1Migrations and
// passed in as TEST_MIGRATIONS) to the Miniflare-backed CATALOG database before
// any test runs, so tests see the real users/tokens/pending_auth schema.
beforeAll(async () => {
  // TEST_MIGRATIONS is a test-only binding (vitest.config.ts), not part of the
  // production Env type — read it through a narrow cast.
  const { TEST_MIGRATIONS } = env as unknown as {
    TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
  };
  await applyD1Migrations(env.CATALOG, TEST_MIGRATIONS);
});
