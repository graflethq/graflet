import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { __setEmailFetchForTests, unsubscribeToken } from "./notify";
import { sha256Hex } from "./tokens";

const BASE = "https://backend.test";
const UPSERT_SECRET = "test-catalog-upsert-secret";
const UNSUB_SECRET = "test-unsubscribe-secret";

// --- helpers ---------------------------------------------------------------

async function makeUser(githubId: number, email: string | null, consent: "unset" | "yes" | "no" = "unset"): Promise<string> {
  const now = new Date().toISOString();
  await env.CATALOG.prepare(
    "INSERT INTO users (github_id, email, created_at, marketing_consent) VALUES (?, ?, ?, ?)",
  )
    .bind(githubId, email, now, consent)
    .run();
  const raw = `tok-${githubId}`;
  await env.CATALOG.prepare("INSERT INTO tokens (token_hash, github_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(raw), githubId, now)
    .run();
  return raw;
}

function upsert(body: Record<string, unknown>) {
  return SELF.fetch(`${BASE}/catalog/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${UPSERT_SECRET}` },
    body: JSON.stringify(body),
  });
}

// A green, latest doc version. status flips graphifying -> ready to fire notify.
function docVersion(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "next.js",
    name: "Next.js",
    repo_url: "https://github.com/vercel/next.js",
    popularity_rank: 1,
    version_label: "16",
    is_latest: true,
    license: "MIT",
    sha: "a".repeat(40),
    docs_path: "docs",
    kg_ref: "vercel/next.js/" + "a".repeat(40),
    ...over,
  };
}

function watchReq(token: string | null, slug: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return SELF.fetch(`${BASE}/watch`, { method: "POST", headers, body: JSON.stringify({ slug }) });
}

function consentReq(token: string, answer: unknown) {
  return SELF.fetch(`${BASE}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answer }),
  });
}

// Capture Resend sends instead of hitting the network.
type Sent = { to: string; subject: string; html: string; headers: Record<string, string> };
function captureEmail(): Sent[] {
  const sent: Sent[] = [];
  __setEmailFetchForTests(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Sent;
    sent.push(body);
    return Response.json({ id: "test" });
  });
  return sent;
}

describe("watch + consent + notify (ticket 08)", () => {
  beforeEach(async () => {
    await env.CATALOG.exec(
      "DELETE FROM subscriptions; DELETE FROM tokens; DELETE FROM doc_versions; DELETE FROM docs; DELETE FROM users;",
    );
  });
  afterEach(() => {
    // Reset the email seam so a test that forgot to capture never hits the network.
    __setEmailFetchForTests(async () => Response.json({ id: "noop" }));
  });

  it("POST /watch signed out is rejected (401), no subscription written", async () => {
    await upsert(docVersion());
    expect((await watchReq(null, "next.js")).status).toBe(401);
    const n = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM subscriptions").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("POST /watch signed in registers (user, doc), idempotent on repeat", async () => {
    await upsert(docVersion());
    const token = await makeUser(1, "a@example.com");

    const first = await watchReq(token, "next.js");
    expect(first.status).toBe(200);
    expect((await first.json()) as any).toMatchObject({ ok: true, slug: "next.js", marketing_consent: "unset" });

    // Re-watch: still one row.
    expect((await watchReq(token, "next.js")).status).toBe(200);
    const n = await env.CATALOG.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE github_id = 1").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it("POST /watch for an unknown doc is 404", async () => {
    const token = await makeUser(1, "a@example.com");
    expect((await watchReq(token, "does-not-exist")).status).toBe(404);
  });

  it("consent unset -> yes records yes with consent_at + source=cli", async () => {
    const token = await makeUser(1, "a@example.com", "unset");
    const res = await consentReq(token, "yes");
    expect(res.status).toBe(200);
    expect((await res.json()) as any).toMatchObject({ ok: true, recorded: true });

    const u = await env.CATALOG.prepare("SELECT marketing_consent, consent_at, consent_source FROM users WHERE github_id = 1").first<any>();
    expect(u.marketing_consent).toBe("yes");
    expect(u.consent_at).toBeTruthy();
    expect(u.consent_source).toBe("cli");
  });

  it("consent is asked once — a second answer never overwrites the first", async () => {
    const token = await makeUser(1, "a@example.com", "no");
    const res = await consentReq(token, "yes"); // try to flip no -> yes
    expect((await res.json()) as any).toMatchObject({ recorded: false });
    const u = await env.CATALOG.prepare("SELECT marketing_consent FROM users WHERE github_id = 1").first<any>();
    expect(u.marketing_consent).toBe("no"); // unchanged
  });

  it("consent rejects a bad answer (400)", async () => {
    const token = await makeUser(1, "a@example.com");
    expect((await consentReq(token, "maybe")).status).toBe(400);
  });

  it("a version going ready emails every watcher — service notify, regardless of consent", async () => {
    const sent = captureEmail();
    await upsert(docVersion({ status: "graphifying" })); // doc exists, not ready yet
    const t1 = await makeUser(1, "yes@example.com", "yes");
    const t2 = await makeUser(2, "no@example.com", "no");
    const t3 = await makeUser(3, "unset@example.com", "unset");
    await watchReq(t1, "next.js");
    await watchReq(t2, "next.js");
    await watchReq(t3, "next.js");

    await upsert(docVersion({ status: "ready" })); // graphifying -> ready

    expect(sent).toHaveLength(3);
    const tos = sent.map((s) => s.to).sort();
    expect(tos).toEqual(["no@example.com", "unset@example.com", "yes@example.com"]);
  });

  it("the promo footer + unsubscribe render only for marketing_consent = yes", async () => {
    const sent = captureEmail();
    await upsert(docVersion({ status: "graphifying" }));
    const tYes = await makeUser(1, "yes@example.com", "yes");
    const tNo = await makeUser(2, "no@example.com", "no");
    await watchReq(tYes, "next.js");
    await watchReq(tNo, "next.js");

    await upsert(docVersion({ status: "ready" }));

    const yes = sent.find((s) => s.to === "yes@example.com")!;
    const no = sent.find((s) => s.to === "no@example.com")!;
    // yes: has postal address + unsubscribe link + RFC 8058 one-click header
    expect(yes.html).toContain("123 Test St, Testville");
    expect(yes.html).toContain("/unsubscribe?u=1");
    expect(yes.headers["List-Unsubscribe"]).toContain("/unsubscribe?u=1");
    expect(yes.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    // no: same notification, no promo block, no unsubscribe header
    expect(no.html).not.toContain("123 Test St");
    expect(no.html).not.toContain("/unsubscribe");
    expect(no.headers["List-Unsubscribe"]).toBeUndefined();
  });

  it("re-POSTing an already-ready version does NOT re-notify (transition only)", async () => {
    const sent = captureEmail();
    await upsert(docVersion({ status: "graphifying" }));
    const t = await makeUser(1, "a@example.com", "yes");
    await watchReq(t, "next.js");

    await upsert(docVersion({ status: "ready" })); // 1 notify
    await upsert(docVersion({ status: "ready" })); // already ready -> no notify
    expect(sent).toHaveLength(1);
  });

  it("a watcher with no email is skipped (no send)", async () => {
    const sent = captureEmail();
    await upsert(docVersion({ status: "graphifying" }));
    const t = await makeUser(1, null, "yes");
    await watchReq(t, "next.js");
    await upsert(docVersion({ status: "ready" }));
    expect(sent).toHaveLength(0);
  });

  it("one-click unsubscribe (POST) with a valid token flips consent to no; invalid token rejected", async () => {
    await makeUser(1, "a@example.com", "yes");
    const t = await unsubscribeToken(1, UNSUB_SECRET);

    // wrong token -> 400, unchanged
    const bad = await SELF.fetch(`${BASE}/unsubscribe?u=1&t=wrong`, { method: "POST" });
    expect(bad.status).toBe(400);
    expect((await env.CATALOG.prepare("SELECT marketing_consent FROM users WHERE github_id = 1").first<any>()).marketing_consent).toBe("yes");

    // correct token -> 200, consent = no, source = unsubscribe
    const ok = await SELF.fetch(`${BASE}/unsubscribe?u=1&t=${t}`, { method: "POST" });
    expect(ok.status).toBe(200);
    const u = await env.CATALOG.prepare("SELECT marketing_consent, consent_source FROM users WHERE github_id = 1").first<any>();
    expect(u.marketing_consent).toBe("no");
    expect(u.consent_source).toBe("unsubscribe");
  });

  it("after unsubscribe the watcher still gets service notifications, without the promo footer", async () => {
    const sent = captureEmail();
    await upsert(docVersion({ status: "graphifying" }));
    const t = await makeUser(1, "a@example.com", "yes");
    await watchReq(t, "next.js");
    // unsubscribe
    await SELF.fetch(`${BASE}/unsubscribe?u=1&t=${await unsubscribeToken(1, UNSUB_SECRET)}`, { method: "POST" });

    await upsert(docVersion({ status: "ready" }));
    expect(sent).toHaveLength(1); // still notified
    expect(sent[0].html).not.toContain("/unsubscribe"); // but no promo footer now
  });

  it("GET /unsubscribe returns a human page (not JSON)", async () => {
    await makeUser(1, "a@example.com", "yes");
    const res = await SELF.fetch(`${BASE}/unsubscribe?u=1&t=${await unsubscribeToken(1, UNSUB_SECRET)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});
