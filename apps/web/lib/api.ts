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
