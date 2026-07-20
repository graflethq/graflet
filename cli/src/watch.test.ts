import { describe, it, expect } from "vitest";
import { watch } from "./watch.js";

const API = "https://backend.test";

// A stub backend: records the calls, returns a chosen consent state for /watch.
function stub(consent: "unset" | "yes" | "no") {
  const calls: { url: string; body: any }[] = [];
  const fetchImpl = (async (input: any, init: any) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.endsWith("/watch")) return Response.json({ ok: true, slug: body.slug, marketing_consent: consent });
    if (url.endsWith("/consent")) return Response.json({ ok: true, recorded: true });
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("cli watch (ticket 08)", () => {
  it("signed out: does not call the backend, exits 1", async () => {
    const { calls, fetchImpl } = stub("unset");
    const code = await watch("next.js", { apiBase: API, fetchImpl, getToken: () => null, prompt: async () => "" });
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("first watch with consent unset: shows the opt-in, decline by default records no", async () => {
    const { calls, fetchImpl } = stub("unset");
    let asked = 0;
    const code = await watch("next.js", {
      apiBase: API,
      fetchImpl,
      getToken: () => "tok",
      prompt: async () => {
        asked++;
        return ""; // user just hits enter -> declines
      },
    });
    expect(code).toBe(0);
    expect(asked).toBe(1);
    const consent = calls.find((c) => c.url.endsWith("/consent"));
    expect(consent?.body.answer).toBe("no");
  });

  it("opt-in prompt: 'y' records yes", async () => {
    const { calls, fetchImpl } = stub("unset");
    await watch("next.js", { apiBase: API, fetchImpl, getToken: () => "tok", prompt: async () => "y" });
    expect(calls.find((c) => c.url.endsWith("/consent"))?.body.answer).toBe("yes");
  });

  it("consent already set: registers the watch WITHOUT prompting or calling /consent", async () => {
    const { calls, fetchImpl } = stub("yes");
    let asked = 0;
    const code = await watch("next.js", {
      apiBase: API,
      fetchImpl,
      getToken: () => "tok",
      prompt: async () => {
        asked++;
        return "y";
      },
    });
    expect(code).toBe(0);
    expect(asked).toBe(0); // never prompted
    expect(calls.some((c) => c.url.endsWith("/consent"))).toBe(false);
    expect(calls.some((c) => c.url.endsWith("/watch"))).toBe(true);
  });

  it("non-interactive (no TTY, prompt returns null): registers watch but leaves consent UNSET", async () => {
    const { calls, fetchImpl } = stub("unset");
    const code = await watch("next.js", {
      apiBase: API,
      fetchImpl,
      getToken: () => "tok",
      prompt: async () => null, // no terminal to ask on
    });
    expect(code).toBe(0);
    expect(calls.some((c) => c.url.endsWith("/watch"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/consent"))).toBe(false); // never recorded
  });

  it("missing slug: usage error, exits 1", async () => {
    const { calls, fetchImpl } = stub("unset");
    const code = await watch("", { apiBase: API, fetchImpl, getToken: () => "tok", prompt: async () => "" });
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
  });
});
