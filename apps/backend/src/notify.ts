/**
 * Watcher email (ticket 08 / ADR-0006).
 *
 * When a watched doc's version goes `ready` (reported via /catalog/upsert), every
 * subscriber gets a SERVICE notification — sent regardless of marketing consent,
 * because they opted into that doc's update stream. The product-promo footer, with
 * a postal address + one-click unsubscribe, renders ONLY for `marketing_consent =
 * yes` recipients. Sending is best-effort: a Resend outage must never fail the
 * catalog write, so the caller wraps notifyWatchers in try/catch.
 *
 * Operator alerts stay on Telegram (poller, ticket 09); watchers only get email.
 */

import type { MarketingConsent } from "./auth";
import { sha256Hex } from "./tokens";

// Outbound-fetch seam, same pattern as github.ts: tests stub email without a
// network call via __setEmailFetchForTests.
let emailFetch: typeof fetch = (...args) => fetch(...args);
export function __setEmailFetchForTests(f: typeof fetch): void {
  emailFetch = f;
}

/** Deterministic per-user unsubscribe token: SHA-256 of `unsub:<id>:<secret>`
 *  (secret last, so it's not length-extension-forgeable). Not reversible,
 *  verified by recompute — a recipient can only unsubscribe their own address. */
export async function unsubscribeToken(githubId: number, secret: string): Promise<string> {
  return sha256Hex(`unsub:${githubId}:${secret}`);
}

interface Recipient {
  github_id: number;
  email: string;
  marketing_consent: MarketingConsent;
}

/** Email every subscriber of `slug` that a new version's KG is ready. */
export async function notifyWatchers(env: Env, origin: string, slug: string, versionLabel: string): Promise<void> {
  // No Resend key configured (local dev without .dev.vars) — nothing to send.
  if (!env.RESEND_API_KEY) return;

  const doc = await env.CATALOG.prepare("SELECT name FROM docs WHERE slug = ?")
    .bind(slug)
    .first<{ name: string }>();
  const name = doc?.name ?? slug;

  const { results } = await env.CATALOG.prepare(
    `SELECT u.github_id, u.email, u.marketing_consent
       FROM subscriptions s JOIN users u ON u.github_id = s.github_id
      WHERE s.slug = ? AND u.email IS NOT NULL AND u.email <> ''`,
  )
    .bind(slug)
    .all<Recipient>();

  // ponytail: sequential sends, O(n) latency on the upsert path — fine at launch
  // (a handful of watchers per doc). Batch/queue via ctx.waitUntil if a popular
  // doc's watcher count makes the upsert POST slow.
  for (const r of results) {
    // Per-recipient try/catch: one bad address must not stop the rest.
    try {
      await sendReadyEmail(env, origin, r, name, slug, versionLabel);
    } catch {
      // best-effort; drop this recipient's send and continue
    }
  }
}

async function sendReadyEmail(
  env: Env,
  origin: string,
  r: Recipient,
  name: string,
  slug: string,
  versionLabel: string,
): Promise<void> {
  const subject = `${name} ${versionLabel} — knowledge graph updated`;
  const notice =
    `<p>A new version of <strong>${name}</strong> is ready.</p>` +
    `<p>Download the docs + knowledge graph:</p>` +
    `<pre>graflet ${slug}@${versionLabel}</pre>`;

  // Promo footer + one-click unsubscribe ONLY for consented recipients (ADR-0006).
  const headers: Record<string, string> = {};
  let html = notice;
  if (r.marketing_consent === "yes") {
    const url = `${origin}/unsubscribe?u=${r.github_id}&t=${await unsubscribeToken(r.github_id, env.UNSUBSCRIBE_SECRET)}`;
    html +=
      `<hr><p>You're getting product updates from Graflet because you opted in.</p>` +
      `<p>${env.MARKETING_POSTAL_ADDRESS}</p>` +
      `<p><a href="${url}">Unsubscribe</a> from product updates.</p>`;
    // RFC 8058 one-click: mail clients POST to this URL to unsubscribe.
    headers["List-Unsubscribe"] = `<${url}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const res = await emailFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM, to: r.email, subject, html, headers }),
  });
  if (!res.ok) throw new Error(`resend send failed (HTTP ${res.status})`);
}
