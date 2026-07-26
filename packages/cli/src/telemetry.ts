/**
 * Opt-in CLI telemetry (ticket 07 / ADR-0010).
 *
 * The whole module is built around one irreversible fact: once a version is on npm
 * phoning home, it is on npm forever. Nobody can un-publish 0.4.0 from a user's
 * lockfile. So the default is **no**, the question is asked **once**, and there are
 * two env kill switches that outrank whatever is stored.
 *
 * Four gates have to open before a single byte leaves. All of them are here, in
 * `startTelemetry`, rather than at the call sites — a call site that forgot one
 * would be a silent privacy regression, and there is no way to notice it from the
 * outside:
 *
 * 1. `GRAFLET_TELEMETRY=0` / `DO_NOT_TRACK` unset — a kill switch wins over a yes.
 * 2. stdin is a TTY. A pipe, a CI runner or a cron job never prompts (that would
 *    hang a build) and never sends (defaulting to yes there is consent by absence).
 * 3. A stored answer exists, or one is obtained from the one prompt below.
 * 4. That answer is yes.
 *
 * What is sent is deliberately small and fixed: four event names, and only the
 * properties the caller hands over — no argv, no cwd, no filenames, no hostname, no
 * env. `capture()` adds nothing of its own, so grepping the four call sites is a
 * complete audit of what the CLI can possibly transmit.
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);

/** Direct, not through the site's reverse proxy: a terminal has no ad blocker to
 *  defeat, and the proxy would only add a hop (ADR-0010, same call as the Worker). */
const POSTHOG_HOST = "https://us.i.posthog.com";

/** The PostHog *public* project token — write-only, and already shipped inside the
 *  site's JS bundle. It can create events and nothing else; it cannot read or delete. */
const PROJECT_KEY = "phc_B2JMYrZWSYybsTw4RmYNmTLKtgqPBZDLzq4jGp5GK5Ex";

export const TELEMETRY_ENV = "GRAFLET_TELEMETRY";

/**
 * Every event the CLI can send, spelled once (`.scratch/posthog/spec.md`). A union
 * rather than `string` for the same reason as the site's and the Worker's: a captured
 * event cannot be renamed retroactively, so a typo would be a permanently split
 * series that no dashboard work can rejoin. It has to fail at compile time.
 */
export type CliEvent = "cli_command_run" | "cli_login_completed" | "cli_download_completed" | "cli_download_failed";

/** Two lines, the cap the ticket sets: what is sent, that it is optional, and that
 *  a bare Enter means no. `[y/N]` is the convention for a no-by-default question. */
export const CONSENT_PROMPT =
  "Send anonymous usage stats so we know which docs to build next? We'd send the\n" +
  "command name, the doc slug and timings — never paths, arguments or file names. [y/N] ";

/** The stored answer. `anonymous_id` exists only once someone has said yes — a
 *  machine that declined gets nothing written that could identify it later.
 *  `github_id` appears at sign-in and is dropped at sign-out (see `identify`). */
export interface Consent {
  enabled: boolean;
  anonymous_id?: string;
  github_id?: string;
}

/** Beside the credential store's plaintext fallback (`~/.config/graflet/token`), same
 *  XDG root. Not in the keyring: a preference is not a secret, and a keyring prompt
 *  to read one would be worse than the telemetry. */
export function telemetryFile(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "graflet", "telemetry.json");
}

/** The stored answer, or null when the question has never been asked. A corrupt or
 *  hand-edited file reads as "never asked" — re-asking is the safe failure here. */
export function readConsent(file: string = telemetryFile()): Consent | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { enabled, anonymous_id, github_id } = parsed as Consent;
    if (typeof enabled !== "boolean") return null;
    const consent: Consent = { enabled };
    if (typeof anonymous_id === "string") consent.anonymous_id = anonymous_id;
    if (typeof github_id === "string") consent.github_id = github_id;
    return consent;
  } catch {
    return null;
  }
}

function writeConsent(consent: Consent, file: string): Consent {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(consent, null, 2)}\n`, { mode: 0o600 });
  return consent;
}

/**
 * Change the answer later — what `graflet telemetry on|off` calls, and the reason
 * the one-time prompt is not a one-way door.
 *
 * Turning it on mints the anonymous id if there isn't one; turning it off keeps the
 * id rather than dropping it, so a person who toggles back on stays one person
 * instead of appearing as a new machine each time.
 */
export function setTelemetryEnabled(enabled: boolean, file: string = telemetryFile()): Consent {
  const existing = readConsent(file) ?? { enabled };
  const next: Consent = { ...existing, enabled };
  if (enabled && !next.anonymous_id) next.anonymous_id = randomUUID();
  if (!enabled) stopTelemetry(); // takes effect in this process too, not just the next run
  return writeConsent(next, file);
}

/**
 * Sign the CLI's telemetry out (called by `graflet logout`), the same two-step the
 * site's `forgetPerson` does and for the same reason: a shared machine must not file
 * the next person's runs under the last one.
 *
 * Dropping `github_id` alone is not enough. The old `anonymous_id` was merged into the
 * departing person at sign-in, so PostHog still resolves it to them — reusing it would
 * hand the next user's anonymous runs straight back to the person who just left. A
 * fresh id is what actually severs the link.
 */
export function forgetPerson(file: string = telemetryFile()): void {
  const existing = readConsent(file);
  if (!existing) return; // never asked, nothing stored — nothing to forget
  const next: Consent = { enabled: existing.enabled };
  if (existing.anonymous_id) next.anonymous_id = randomUUID();
  try {
    writeConsent(next, file);
  } catch {
    // Unwritable config: the identity outlives the sign-out, but `logout` itself
    // must still succeed — forgetting the bearer token is the part that matters.
  }
  if (active) active.distinctId = next.anonymous_id ?? active.distinctId;
}

/** True when an env var hard-disables telemetry, whatever the stored answer says.
 *  `DO_NOT_TRACK` follows consoledonottrack.com: `1` or `true` means off. */
export function disabledByEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env[TELEMETRY_ENV] === "0") return true;
  return env.DO_NOT_TRACK === "1" || env.DO_NOT_TRACK === "true";
}

/** The published version, for `cli_command_run`. Read from the package's own
 *  manifest rather than baked in, so it cannot drift from what npm installed. */
export function cliVersion(): string {
  try {
    return (require("../package.json") as { version: string }).version;
  } catch {
    return "unknown";
  }
}

export interface StartOptions {
  file?: string;
  /** Ask one line, printing the question. `null` means there was no TTY — the same
   *  contract as index.ts's askLine. The caller owns the stream, and points it at
   *  STDERR: `graflet <slug>` promises stdout carries exactly one line, the
   *  destination path, and a question is not that line. */
  ask?: (question: string) => Promise<string | null>;
  env?: NodeJS.ProcessEnv;
  /** Defaults to `process.stdin.isTTY`. Gate 2 above — injected so a test needn't
   *  depend on how the runner happened to wire its streams. */
  isTTY?: boolean;
  fetchImpl?: typeof fetch;
}

// Null until every gate opens. Nothing can be sent while this is null, which is what
// makes "sends nothing before startTelemetry has run" true for tests and for any
// future command that forgets to call it.
//
// ponytail: module state, where `apps/backend/src/analytics.ts` hands a `Tracker` to
// each handler. A Worker isolate serves many people concurrently and MUST NOT share
// one; a CLI process is one person, one run, so the seam that buys the Worker
// correctness would only buy this file a parameter on every call site. The ceiling is
// concurrency: the day anything here runs two users in one process, take the
// `Tracker` shape from analytics.ts wholesale.
let active: { distinctId: string; anonymousId: string; file: string; fetchImpl: typeof fetch } | null = null;
const inFlight: Promise<unknown>[] = [];

/**
 * Open the four gates, prompting at most once. Returns whether telemetry is on for
 * this run. Never throws: an unwritable config dir means telemetry stays off, not
 * that `graflet react` dies.
 */
export async function startTelemetry(opts: StartOptions = {}): Promise<boolean> {
  const file = opts.file ?? telemetryFile();
  const isTTY = opts.isTTY ?? process.stdin.isTTY === true;

  // Gates 1 and 2. Both return BEFORE the prompt: a kill switch that still asked the
  // question would be pointless, and asking with no TTY would hang a CI build.
  if (disabledByEnv(opts.env ?? process.env) || !isTTY) return false;

  let consent = readConsent(file);
  if (!consent) {
    const answer = opts.ask ? await opts.ask(CONSENT_PROMPT) : null;
    if (answer === null) return false; // no TTY after all — record nothing, silence is not an answer
    const yes = /^y(es)?$/i.test(answer.trim());
    try {
      consent = writeConsent(yes ? { enabled: true, anonymous_id: randomUUID() } : { enabled: false }, file);
    } catch {
      // Read-only home, no disk: honour the answer for this run, ask again next time.
      consent = yes ? { enabled: true, anonymous_id: randomUUID() } : { enabled: false };
    }
  }

  // Gate 4, plus the id itself: an `enabled` record with no id is a file someone
  // hand-edited, or one written by a run whose `$HOME` went read-only mid-flight.
  // Mint one rather than sending against `undefined` — and do it inside a try, because
  // this is the last place left that touches the disk and "never throws" has to hold:
  // an EACCES escaping here would kill `graflet react` over a usage stat.
  if (!consent.enabled) return false;
  let anonymousId = consent.anonymous_id;
  if (!anonymousId) {
    anonymousId = randomUUID();
    try {
      writeConsent({ ...consent, anonymous_id: anonymousId }, file);
    } catch {
      // Unwritable: this run reports under a one-off id, the next mints another.
    }
  }

  // Once signed in, runs are filed under the `github_id` the site and the Worker also
  // use, so the CLI's half of the funnel lands on the person rather than only on the
  // machine. Before sign-in — and after `logout` clears it — that is the anonymous id.
  active = {
    distinctId: consent.github_id ?? anonymousId,
    anonymousId,
    file,
    fetchImpl: opts.fetchImpl ?? fetch,
  };
  return true;
}

/** Turn capture off for the rest of the process (tests, and `telemetry off`). */
export function stopTelemetry(): void {
  active = null;
  inFlight.length = 0;
}

/**
 * Record one event. Fire-and-forget by construction — the request is started and its
 * promise parked for `flush()`, so nothing here can delay, fail or interrupt the
 * command the user actually ran.
 *
 * `properties` is passed through UNTOUCHED and nothing is added to it. That is the
 * ticket's "no paths, no argv, no hostnames" guarantee, and it is why grepping the
 * four call sites is a complete audit of what can leave this machine.
 */
export function capture(event: CliEvent, properties?: Record<string, unknown>): void {
  if (!active) return;
  post({ event, distinct_id: active.distinctId, properties: properties ?? {} });
}

/**
 * Merge the machine-local id into the person the site and the Worker already know
 * (ticket 07 / the spec's identity rules). `$anon_distinct_id` is what makes it a
 * merge rather than a second person: everything the machine did before signing in
 * joins the same timeline, which is the whole point of the site→CLI funnel.
 *
 * `githubId` is the numeric GitHub id as a string, never the login — a handle can be
 * renamed, and a renamed handle would fork one person into two with no way back.
 */
export function identify(githubId: string): void {
  // Already this person: nothing to merge. The guard is what lets the download path
  // call this on EVERY download (it learns the id from a response header) without
  // firing a redundant `$identify` every time.
  if (!active || active.distinctId === githubId) return;
  post({ event: "$identify", distinct_id: githubId, properties: { $anon_distinct_id: active.anonymousId } });
  active.distinctId = githubId;
  try {
    writeConsent({ ...(readConsent(active.file) ?? { enabled: true }), github_id: githubId }, active.file);
  } catch {
    // Unwritable config: this run still lands on the right person, later ones fall
    // back to the anonymous id — which the merge above already points at them anyway.
  }
}

/**
 * Wait, briefly, for what is in flight — then give up.
 *
 * A CLI ends in `process.exit`, which kills pending sockets, so with no flush at all
 * nothing would ever arrive. The wait sits AFTER the command has finished and printed
 * everything, and is capped, so the worst case is a second of silence on exit rather
 * than a command that hangs because PostHog is down. Never rejects.
 *
 * ponytail: this is the one place the ticket's "no network wait that delays a command"
 * is read as "no wait a user experiences DURING the command" rather than literally.
 * Taken literally it means shipping telemetry that can never deliver anything. Two
 * things keep the trade honest: nothing is in flight at all unless the user opted in
 * (so the default path costs exactly zero), and each request carries its own 1s
 * `AbortSignal`, so the cap is real rather than a hope about socket behaviour.
 */
export async function flush(timeoutMs = 1000): Promise<void> {
  if (inFlight.length === 0) return;
  const pending = inFlight.splice(0, inFlight.length);
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    Promise.allSettled(pending),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref?.(); // never hold the process open on the timer itself
    }),
  ]);
  clearTimeout(timer);
}

/**
 * The transport. `$ip: null` is the one thing added to every payload, and it is here
 * rather than in `capture()` on purpose: `capture()` stays a pass-through, so grepping
 * its call sites is still a complete audit of the *data* the CLI sends.
 *
 * It has to be added at all because a server-side capture arrives over a plain HTTP
 * request, and PostHog would otherwise store the sender's IP and derive a location
 * from it. Neither is in the list of things this CLI sends, and /privacy says so —
 * `$ip: null` is PostHog's documented way to make that true rather than aspirational.
 */
function post(payload: Record<string, unknown>): void {
  const sender = active;
  if (!sender) return;
  const { properties, ...rest } = payload as { properties?: Record<string, unknown> };
  try {
    inFlight.push(
      sender
        .fetchImpl(`${POSTHOG_HOST}/i/v0/e/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: PROJECT_KEY, ...rest, properties: { ...properties, $ip: null } }),
          // A firewall that blackholes rather than refuses would otherwise hold the
          // socket for the OS default. The flush below waits on this, so an unbounded
          // request is an unbounded exit.
          signal: AbortSignal.timeout(1000),
        })
        // Swallowed on purpose: telemetry failure is invisible.
        // ponytail: no retry and no on-disk queue, so an offline run's events are gone
        // rather than delivered later. A usage stat is not worth a second round trip on
        // a flaky network, and a spool file is a second thing to promise on /privacy.
        // The ceiling is systematic loss — if offline users ever skew the numbers, the
        // fix is a bounded spool next to the consent file, not a retry loop here.
        .catch(() => {}),
    );
  } catch {
    // A fetch that throws synchronously (no global fetch on an ancient runtime).
  }
}
