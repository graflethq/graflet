import type { CatalogDoc } from "./catalog";

/**
 * The read-only catalog API (backend Worker, ticket 02) — CORS-allowed for this
 * origin. Reads need no sign-in (ADR-0005). Base URL comes from the build-time
 * public env var; falls back to the local `wrangler dev` port for development.
 */
export const CATALOG_API_URL =
  process.env.NEXT_PUBLIC_CATALOG_API_URL?.replace(/\/$/, "") || "http://localhost:8787";

/** GET /catalog → the ready docs. Throws on a non-2xx so callers show the error state. */
export async function fetchCatalog(signal?: AbortSignal): Promise<CatalogDoc[]> {
  const res = await fetch(`${CATALOG_API_URL}/catalog`, { signal });
  if (!res.ok) throw new Error(`catalog request failed: ${res.status}`);
  const data = (await res.json()) as { docs?: CatalogDoc[] };
  return data.docs ?? [];
}

/**
 * GET /stars → the repo's star count for the nav's ★ Star button, or null when the
 * backend couldn't reach GitHub. Null is a normal answer, not an error: the nav
 * renders no count for it, which is what it already does below the display floor.
 * Routed through our Worker (cached an hour) so a visitor's IP never spends a
 * GitHub rate-limit slot.
 */
export async function fetchStars(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(`${CATALOG_API_URL}/stars`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { stars?: number | null };
    return typeof data.stars === "number" ? data.stars : null;
  } catch {
    return null;
  }
}

/**
 * The website GitHub sign-in entry point on the backend Worker (ticket 06). A
 * top-level navigation here runs the OAuth code-exchange server-side — the client
 * secret never ships to the browser (ADR-0001). `consent` carries the unchecked-
 * by-default opt-in (ADR-0006); the backend redirects back to `returnTo` with
 * `#login=&consent=` once done. No fetch, no token in the browser.
 */
export function authStartUrl(consent: "yes" | "no", returnTo: string): string {
  const q = new URLSearchParams({ consent, return_to: returnTo });
  return `${CATALOG_API_URL}/auth/web/start?${q}`;
}

/**
 * Start the account-deletion round trip (ticket 09). The same GitHub OAuth leg as
 * sign-in, flagged `intent=delete`, which comes back with a one-time token in the
 * fragment instead of a session. The website mints no bearer token at all
 * (ADR-0001), so this trip is the only proof of identity there is to offer.
 */
export function accountDeleteStartUrl(returnTo: string): string {
  const q = new URLSearchParams({ intent: "delete", return_to: returnTo });
  return `${CATALOG_API_URL}/auth/web/start?${q}`;
}

/**
 * Spend the one-time token: erases our rows AND the PostHog person, or throws with
 * the backend's own message. It throws rather than returning a flag because a failed
 * erasure has to be visible — a delete button that quietly does nothing is worse
 * than no button (ADR-0010: erasure is an obligation, not housekeeping).
 */
export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${CATALOG_API_URL}/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `deletion failed (${res.status})`);
  }
}
