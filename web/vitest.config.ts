import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Frontend tests: pure modules (lib/) run anywhere; the few behavior checks
// (copy fires no fetch, a missing metric renders "—") need a DOM, so jsdom is
// the default environment. Same runner/style as backend/ (vitest). esbuild's
// automatic JSX transform renders TSX — no @vitejs/plugin-react needed for tests.
export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    // A concrete origin (not the opaque about:blank default) so localStorage +
    // window.location work — the signup panel reads both (ticket 06). Matches the
    // dev origin the CORS allow-list + api.ts default already use.
    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["{app,lib,components}/**/*.test.{ts,tsx}"],
  },
});
