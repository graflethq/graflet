/**
 * Test-only: an opted-in CLI whose events are collected instead of sent.
 *
 * Shared because three suites (`telemetry`, `download`, `login`) all need the same
 * four-line bootstrap — a throwaway consent file, a TTY, a `yes`, and a `fetch` that
 * decodes rather than transmits. Excluded from the build in tsconfig.json, so it
 * never reaches `dist/` or the npm tarball.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { flush, startTelemetry } from "./telemetry.js";

/** One captured request body, as PostHog would have received it. */
export interface SentEvent {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}

export interface Collector {
  /** Everything sent so far. Read it after `settle()`. */
  sent: SentEvent[];
  /** Wait for in-flight requests, then return what was sent. */
  settle: () => Promise<SentEvent[]>;
  /** …minus `$identify`, for suites asserting on product events alone. */
  events: () => Promise<SentEvent[]>;
  /** Forget what has been collected so far. */
  reset: () => void;
}

/** Opt in against a throwaway consent file, collecting every payload. */
export async function collectTelemetry(): Promise<Collector> {
  const sent: SentEvent[] = [];
  await startTelemetry({
    file: join(mkdtempSync(join(tmpdir(), "graflet-tel-")), "telemetry.json"),
    isTTY: true,
    env: {},
    ask: async () => "y",
    fetchImpl: (async (_url: unknown, init: { body?: unknown }) => {
      sent.push(JSON.parse(String(init.body)) as SentEvent);
      return new Response("ok");
    }) as unknown as typeof fetch,
  });
  const settle = async () => (await flush(), sent);
  return {
    sent,
    settle,
    events: async () => (await settle()).filter((e) => e.event !== "$identify"),
    reset: () => void sent.splice(0, sent.length),
  };
}

/**
 * The property names a payload carries, minus PostHog's own `$`-prefixed controls.
 *
 * Every event gets `$ip: null` from the transport, which is the CLI *suppressing* a
 * field rather than sending one. Filtering it here keeps the "these are the only
 * properties we send" assertions readable, and `expectsNoIp` below pins the
 * suppression itself so nothing silently stops doing it.
 */
export function dataKeys(e: SentEvent): string[] {
  return Object.keys(e.properties)
    .filter((k) => !k.startsWith("$"))
    .sort();
}

/** True when the payload actively discards the sender's IP (and so its geolocation). */
export function discardsIp(e: SentEvent): boolean {
  return e.properties.$ip === null;
}
