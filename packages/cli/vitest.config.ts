import { defineConfig } from "vitest/config";

// Plain Node tests (no Cloudflare pool here — this is the CLI, not the Worker).
export default defineConfig({
  test: { environment: "node" },
});
