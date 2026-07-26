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
import {
  capture,
  cliVersion,
  disabledByEnv,
  flush,
  readConsent,
  setTelemetryEnabled,
  startTelemetry,
  telemetryFile,
  TELEMETRY_ENV,
} from "./telemetry.js";
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
  graflet telemetry [on|off]  Show or change anonymous usage stats (default: off)
  graflet --help              Show this help

Env:
  GRAFLET_API       Override the backend URL
  GRAFLET_TOKEN     Use a bearer token directly (CI; skips the browser)
  GRAFLET_TELEMETRY Set to 0 to disable usage stats entirely
  DO_NOT_TRACK      Set to 1 to disable usage stats entirely
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

  // `telemetry` is settled BEFORE the consent gate: someone typing it is already
  // answering the question, and asking it first would be a prompt to reach a prompt.
  if (cmd === "telemetry") return telemetryCommand(process.argv[3]);

  // The consent gate for every real command (ticket 07). Asks at most once, ever,
  // and only on a TTY; every kill switch is checked inside. The prompt goes to
  // STDERR — `graflet <slug>` promises stdout carries exactly one line.
  await startTelemetry({ ask: (q) => askLine(q, process.stderr) });
  // The one property is the SUBCOMMAND, never the slug or anything else off argv:
  // `graflet <slug>` is reported as "download", and which doc it was travels on
  // `cli_download_completed` where it belongs.
  capture("cli_command_run", { command: RESERVED.has(cmd) ? cmd : "download", cli_version: cliVersion() });

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

/** The subcommands that are NOT slugs. Anything else is a doc to download. */
const RESERVED = new Set(["login", "logout", "watch", "telemetry"]);

/**
 * `graflet telemetry [on|off]` — the documented way to change the one-time answer
 * (ticket 07), which is what stops the first prompt being a one-way door.
 *
 * Everything it prints goes to stdout: this command's whole output IS the answer,
 * unlike `graflet <slug>` where stdout is reserved for the destination path.
 */
function telemetryCommand(arg: string | undefined): number {
  if (arg === "on" || arg === "off") {
    setTelemetryEnabled(arg === "on");
    process.stdout.write(`Usage stats ${arg === "on" ? "on" : "off"}. Stored in ${telemetryFile()}\n`);
    return 0;
  }
  if (arg !== undefined) {
    process.stderr.write("Usage: graflet telemetry [on|off]\n");
    return 1;
  }
  const consent = readConsent();
  // The env kill switches outrank the stored answer, so a status line that reported
  // only the file would be a lie on any machine that sets one.
  if (disabledByEnv()) {
    process.stdout.write(`Usage stats off — disabled by ${TELEMETRY_ENV}/DO_NOT_TRACK in this environment.\n`);
    return 0;
  }
  process.stdout.write(
    consent === null
      ? "Usage stats off — never asked yet. `graflet telemetry on` opts in.\n"
      : `Usage stats ${consent.enabled ? "on" : "off"}. Stored in ${telemetryFile()}\n`,
  );
  return 0;
}

/**
 * Ask one line on the terminal, or null when there's no TTY (piped/CI) — the caller
 * records nothing rather than a silent answer. Both callers follow that rule for
 * their own reasons: marketing consent per ADR-0006, analytics consent per ADR-0010.
 * They are separate bases and must stay separate — ADR-0010 is explicit that
 * conflating the two is a compliance error, so this shared prompt helper carries the
 * mechanics and neither question's meaning.
 *
 * `out` is where the question is printed; stderr for anything running alongside
 * `graflet <slug>`, whose stdout belongs to the destination path alone.
 */
async function askLine(question: string, out: NodeJS.WritableStream = process.stdout): Promise<string | null> {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: out });
  try {
    // Ctrl+D closes stdin without answering, and `rl.question`'s promise then never
    // settles — which would hang `graflet react` at a question the user just declined
    // to answer. Race the close so an EOF reads as an empty line: the same as Enter,
    // and every caller here treats an empty line as "no".
    return await Promise.race([
      rl.question(question),
      new Promise<string>((resolve) => rl.once("close", () => resolve(""))),
    ]);
  } finally {
    rl.close();
  }
}

// Commands throw an Error with a user-facing message on any expected failure
// (unknown slug, expired sign-in, …). Print just the message — never a stack —
// and exit 1, so a bad slug reads as one clear line, not an unhandled rejection.
//
// `flush` on both paths, and only here: `process.exit` kills pending sockets, so
// without it no opted-in event would ever arrive. It runs AFTER the command has
// printed everything and is capped inside, so the worst case is a moment of silence
// on exit — never a command that hangs because PostHog is unreachable. It resolves
// even when every request failed, so it cannot change the exit code either.
main()
  .then(async (code) => {
    await flush();
    process.exit(code);
  })
  .catch(async (err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    await flush();
    process.exit(1);
  });
