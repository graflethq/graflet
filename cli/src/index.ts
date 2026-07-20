#!/usr/bin/env node
/**
 * docs-kg CLI entry (ticket 03 scope: login / logout + --help).
 *
 * Auth gates only the KG download (ADR-0005), so `--help` and unknown-command
 * usage run signed-out — no command here reads or requires a token.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { login, logout } from "./login.js";
import { watch } from "./watch.js";

// Backend base URL. Prod URL is operator-provisioned (Cloudflare account not yet
// live) — override with $DOCS_KG_API until it's pinned. TODO: bake the real URL.
const DEFAULT_API = "https://docs-kg-backend.example.workers.dev";
const apiBase = () => process.env.DOCS_KG_API || DEFAULT_API;

const HELP = `docs-kg — download docs + knowledge graphs

Usage:
  docs-kg login         Sign in with GitHub
  docs-kg logout        Forget the stored sign-in
  docs-kg watch <slug>  Get emailed when a doc's graph updates (needs sign-in)
  docs-kg --help        Show this help

Env:
  DOCS_KG_API       Override the backend URL
  DOCS_KG_TOKEN     Use a bearer token directly (CI; skips the browser)
`;

/** Open a URL in the default browser. Best-effort — the caller also prints it. */
function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    // non-fatal; the URL was already printed
  }
}

async function main(): Promise<number> {
  const cmd = process.argv[2];

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  switch (cmd) {
    case "login":
      return login({ apiBase: apiBase(), openBrowser });
    case "logout":
      return logout();
    case "watch":
      return watch(process.argv[3], { apiBase: apiBase(), prompt: askLine });
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

/** Ask one line on the terminal, or null when there's no TTY (piped/CI) — the
 *  caller leaves consent unset rather than recording a silent answer (ADR-0006). */
async function askLine(question: string): Promise<string | null> {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

main().then((code) => process.exit(code));
