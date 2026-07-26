import { describe, it, expect, vi, afterEach } from "vitest";
import { login, logout } from "./login";
import { stopTelemetry } from "./telemetry";
import { collectTelemetry } from "./telemetry.fixture";
import type { PollResponse } from "./api";

const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

// A fake backend: /start always returns a fixed url+state; /poll drains a queue.
function makeFetch(pollSequence: PollResponse[]) {
  const queue = [...pollSequence];
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/auth/cli/start")) return json({ authorize_url: "https://github.test/authorize?x=1", state: "st" });
    if (u.endsWith("/auth/cli/poll")) return json(queue.shift() ?? { status: "pending" });
    throw new Error(`unexpected fetch: ${u}`);
  }) as unknown as typeof fetch;
}

describe("login (ticket 03)", () => {
  it("opens the browser, waits through pending, stores the token, reports the login", async () => {
    const saved: string[] = [];
    const opened: string[] = [];
    const logs: string[] = [];

    const code = await login({
      apiBase: "http://backend",
      fetchImpl: makeFetch([{ status: "pending" }, { status: "complete", token: "tok123", login: "octocat" }]),
      openBrowser: (u) => opened.push(u),
      save: (t) => saved.push(t),
      sleep: async () => {},
      log: (m) => logs.push(m),
    });

    expect(code).toBe(0);
    expect(saved).toEqual(["tok123"]);
    expect(opened).toEqual(["https://github.test/authorize?x=1"]);
    expect(logs.some((l) => l.includes("Signed in as octocat"))).toBe(true);
    // Sign-in is identity only: nothing here asks about marketing consent.
    expect(logs.some((l) => /consent|marketing|subscribe/i.test(l))).toBe(false);
  });

  it("returns non-zero and stores nothing when the authorization is denied", async () => {
    const saved: string[] = [];
    const code = await login({
      apiBase: "http://backend",
      fetchImpl: makeFetch([{ status: "error", error: "access_denied" }]),
      save: (t) => saved.push(t),
      sleep: async () => {},
      log: () => {},
    });
    expect(code).toBe(1);
    expect(saved).toEqual([]);
  });

  it("returns non-zero when the sign-in link expires", async () => {
    const code = await login({
      apiBase: "http://backend",
      fetchImpl: makeFetch([{ status: "expired" }]),
      save: () => {},
      sleep: async () => {},
      log: () => {},
    });
    expect(code).toBe(1);
  });
});

describe("logout (ticket 03)", () => {
  it("clears the stored token and exits 0", () => {
    let cleared = 0;
    const code = logout({ clear: () => cleared++, forget: () => {}, log: () => {} });
    expect(code).toBe(0);
    expect(cleared).toBe(1);
  });

  it("forgets the telemetry identity too — a shared machine must not inherit the last person", () => {
    let forgot = 0;
    logout({ clear: () => {}, forget: () => forgot++, log: () => {} });
    expect(forgot).toBe(1);
  });
});

describe("login telemetry (ticket 07)", () => {
  afterEach(() => stopTelemetry());

  const deps = (poll: PollResponse[]) => ({
    apiBase: "http://backend",
    fetchImpl: makeFetch(poll),
    save: () => {},
    sleep: async () => {},
    log: () => {},
  });

  it("identifies to the github_id, then files the sign-in under that person", async () => {
    const t = await collectTelemetry();
    expect(t.sent).toEqual([]); // starting up sends nothing

    await login(deps([{ status: "complete", token: "tok123", login: "octocat", github_id: "42" }]));
    const sent = await t.settle();

    expect(sent.map((e) => e.event)).toEqual(["$identify", "cli_login_completed"]);
    expect(sent[0].distinct_id).toBe("42");
    expect(sent[0].properties.$anon_distinct_id).toMatch(/^[0-9a-f-]{36}$/);
    // The merge happened first, so the event itself belongs to the person, not the machine.
    expect(sent[1].distinct_id).toBe("42");
    // The GitHub handle is never a distinct_id — it can be renamed out from under us.
    expect(JSON.stringify(sent)).not.toContain("octocat");
  });

  it("a backend too old to return github_id still signs in, just anonymously", async () => {
    const t = await collectTelemetry();
    const code = await login(deps([{ status: "complete", token: "tok123", login: "octocat" }]));
    const sent = await t.settle();

    expect(code).toBe(0);
    expect(sent.map((e) => e.event)).toEqual(["cli_login_completed"]);
    expect(sent[0].distinct_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("a failed sign-in reports nothing", async () => {
    const t = await collectTelemetry();
    await login(deps([{ status: "error", error: "access_denied" }]));
    expect(await t.settle()).toEqual([]);
  });
});
