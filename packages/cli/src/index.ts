#!/usr/bin/env node
/**
 * graflet CLI entry (ticket 03 scope: login / logout + --help).
 *
 * Auth gates only the KG download (ADR-0005), so `--help` and unknown-command
 * usage run signed-out — no command here reads or requires a token.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { download } from "./download.js";
import { login, logout } from "./login.js";
import { watch } from "./watch.js";

// Backend base URL — the live production API (wrangler.jsonc routes graflet-backend
// at this custom domain). $GRAFLET_API overrides it for local dev / staging.
const DEFAULT_API = "https://api.graflet.rnui.dev";
const apiBase = () => process.env.GRAFLET_API || DEFAULT_API;

const HELP = `graflet — download docs + knowledge graphs

Usage:
  graflet <slug>[@<version>]  Download a doc's Markdown + knowledge graph (needs sign-in)
  graflet login               Sign in with GitHub
  graflet logout              Forget the stored sign-in
  graflet watch <slug>        Get emailed when a doc's graph updates (needs sign-in)
  graflet --help              Show this help

Env:
  GRAFLET_API       Override the backend URL
  GRAFLET_TOKEN     Use a bearer token directly (CI; skips the browser)
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
      // Anything that isn't a reserved subcommand IS a slug — `graflet <slug>` is
      // the core command (a bad slug 404s with a clear message from the broker).
      return download(cmd, { apiBase: apiBase() });
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

// Commands throw an Error with a user-facing message on any expected failure
// (unknown slug, expired sign-in, …). Print just the message — never a stack —
// and exit 1, so a bad slug reads as one clear line, not an unhandled rejection.
main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
