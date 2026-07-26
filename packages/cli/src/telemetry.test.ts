import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  CONSENT_PROMPT,
  TELEMETRY_ENV,
  capture,
  cliVersion,
  disabledByEnv,
  flush,
  forgetPerson,
  identify,
  readConsent,
  setTelemetryEnabled,
  startTelemetry,
  stopTelemetry,
} from "./telemetry";
import { dataKeys, discardsIp, type SentEvent } from "./telemetry.fixture";

let file: string;
/** Every request the CLI would have made, decoded. Empty means nothing was sent. */
let sent: { url: string; body: Record<string, unknown> }[];
let fetchImpl: typeof fetch;

/** A prompt answerer. `null` stands in for "no TTY" the way index.ts's askLine does. */
function answers(...replies: (string | null)[]) {
  const asked: string[] = [];
  return {
    asked,
    ask: async (q: string) => {
      asked.push(q);
      return replies.shift() ?? "";
    },
  };
}

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "graflet-tel-")), "telemetry.json");
  sent = [];
  fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response("ok");
  }) as typeof fetch;
});

afterEach(() => stopTelemetry());

/** Start with the sane defaults for a consented, interactive run. */
const start = (opts: Parameters<typeof startTelemetry>[0] = {}) =>
  startTelemetry({ file, isTTY: true, env: {}, fetchImpl, ask: async () => "", ...opts });

describe("consent (ticket 07)", () => {
  it("asks once, defaults to no on a bare Enter, and never asks again", async () => {
    const first = answers("");
    expect(await start({ ask: first.ask })).toBe(false);
    expect(first.asked).toEqual([CONSENT_PROMPT]);
    expect(readConsent(file)).toEqual({ enabled: false });

    const second = answers("y");
    expect(await start({ ask: second.ask })).toBe(false);
    expect(second.asked).toEqual([]); // the stored "no" is final until changed explicitly
  });

  it("a yes is remembered and mints a machine-local anonymous id", async () => {
    expect(await start({ ask: async () => "y" })).toBe(true);
    const stored = readConsent(file);
    expect(stored?.enabled).toBe(true);
    expect(stored?.anonymous_id).toMatch(/^[0-9a-f-]{36}$/);

    // Second run: no prompt, same id — one machine is one person.
    const again = answers();
    expect(await start({ ask: again.ask })).toBe(true);
    expect(again.asked).toEqual([]);
    expect(readConsent(file)?.anonymous_id).toBe(stored?.anonymous_id);
  });

  it("declining a yes stores nothing that identifies the machine", async () => {
    await start({ ask: async () => "n" });
    expect(readConsent(file)).toEqual({ enabled: false });
  });

  it("with no TTY it neither prompts nor sends, and records no answer", async () => {
    const q = answers();
    expect(await start({ isTTY: false, ask: q.ask })).toBe(false);
    expect(q.asked).toEqual([]);
    expect(fs.existsSync(file)).toBe(false); // silence is not an answer

    capture("cli_command_run", { command: "react" });
    await flush();
    expect(sent).toEqual([]);
  });

  it("stays silent without prompting even when the stored answer is yes", async () => {
    setTelemetryEnabled(true, file);
    const q = answers();
    expect(await start({ isTTY: false, ask: q.ask })).toBe(false);
    expect(q.asked).toEqual([]);
  });
});

describe("kill switches (ticket 07)", () => {
  it.each([
    [{ [TELEMETRY_ENV]: "0" }],
    [{ DO_NOT_TRACK: "1" }],
    [{ DO_NOT_TRACK: "true" }],
  ])("%o disables capture even with a stored yes", async (env) => {
    setTelemetryEnabled(true, file);
    expect(disabledByEnv(env)).toBe(true);

    const q = answers();
    expect(await start({ env, ask: q.ask })).toBe(false);
    expect(q.asked).toEqual([]); // a kill switch does not get to ask either

    capture("cli_command_run", { command: "react" });
    identify("42");
    await flush();
    expect(sent).toEqual([]);
  });

  it("leaves telemetry alone when the vars are absent or unset-looking", () => {
    expect(disabledByEnv({})).toBe(false);
    expect(disabledByEnv({ DO_NOT_TRACK: "0" })).toBe(false);
    expect(disabledByEnv({ [TELEMETRY_ENV]: "1" })).toBe(false);
  });
});

describe("capture (ticket 07)", () => {
  it("posts exactly the given properties against the anonymous id", async () => {
    await start({ ask: async () => "y" });
    const anon = readConsent(file)!.anonymous_id;

    capture("cli_command_run", { command: "react", cli_version: cliVersion() });
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(sent[0].body).toMatchObject({
      event: "cli_command_run",
      distinct_id: anon,
      properties: { command: "react", cli_version: cliVersion() },
    });
    // Nothing beyond the declared properties rides along…
    expect(dataKeys(sent[0].body as SentEvent)).toEqual(["cli_version", "command"]);
    // …and the transport actively discards the sender's IP, which a server-side
    // capture would otherwise carry and geolocate. /privacy promises it doesn't.
    expect(discardsIp(sent[0].body as SentEvent)).toBe(true);
  });

  it("identify merges the machine id into the github_id", async () => {
    await start({ ask: async () => "y" });
    const anon = readConsent(file)!.anonymous_id;

    identify("42");
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({
      event: "$identify",
      distinct_id: "42",
      properties: { $anon_distinct_id: anon },
    });
  });

  it("after identify, this run and the next are filed under the github_id", async () => {
    await start({ ask: async () => "y" });
    identify("42");
    capture("cli_download_completed", { doc: "react", version: "19", duration_ms: 10, bytes: 1 });
    await flush();
    expect(sent[1].body.distinct_id).toBe("42");
    expect(readConsent(file)?.github_id).toBe("42");

    stopTelemetry();
    sent = [];
    await start();
    capture("cli_command_run", { command: "download", cli_version: cliVersion() });
    await flush();
    expect(sent[0].body.distinct_id).toBe("42");
  });

  it("forgetPerson drops the person AND the merged anonymous id", async () => {
    await start({ ask: async () => "y" });
    const anon = readConsent(file)!.anonymous_id;
    identify("42");

    forgetPerson(file);

    const after = readConsent(file)!;
    expect(after.github_id).toBeUndefined();
    // A fresh id: the old one resolves to person 42 forever, so reusing it would hand
    // the next user of this machine straight back to the account that just signed out.
    expect(after.anonymous_id).toBeTruthy();
    expect(after.anonymous_id).not.toBe(anon);
    expect(after.enabled).toBe(true); // signing out is not withdrawing consent

    sent = [];
    capture("cli_command_run", { command: "login", cli_version: cliVersion() });
    await flush();
    expect(sent[0].body.distinct_id).toBe(after.anonymous_id);
  });

  it("a rejecting PostHog is invisible: no throw, nothing printed, flush still resolves", async () => {
    const printed: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => void printed.push(String(chunk)) || true);
    try {
      await start({
        ask: async () => "y",
        fetchImpl: (async () => {
          throw new Error("getaddrinfo ENOTFOUND us.i.posthog.com");
        }) as typeof fetch,
      });

      expect(() => capture("cli_download_failed", { reason: "network" })).not.toThrow();
      await expect(flush()).resolves.toBeUndefined();
      expect(printed).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("sends nothing before startTelemetry has run", async () => {
    capture("cli_command_run", { command: "react" });
    await flush();
    expect(sent).toEqual([]);
  });
});

describe("changing the answer later (ticket 07)", () => {
  it("setTelemetryEnabled(false) stops all sending", async () => {
    await start({ ask: async () => "y" });
    setTelemetryEnabled(false, file);

    const q = answers();
    expect(await start({ ask: q.ask })).toBe(false);
    expect(q.asked).toEqual([]);

    capture("cli_command_run", { command: "react" });
    await flush();
    expect(sent).toEqual([]);
  });

  it("setTelemetryEnabled(true) mints an id and turns sending back on", async () => {
    setTelemetryEnabled(false, file);
    const on = setTelemetryEnabled(true, file);
    expect(on.anonymous_id).toBeTruthy();
    expect(await start({ ask: async () => "" })).toBe(true);
  });
});

describe("cliVersion", () => {
  it("reports the published package version", () => {
    expect(cliVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
