import { describe, it, expect, vi } from "vitest";
import { login, logout } from "./login";
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
    const code = logout({ clear: () => cleared++, log: () => {} });
    expect(code).toBe(0);
    expect(cleared).toBe(1);
  });
});
