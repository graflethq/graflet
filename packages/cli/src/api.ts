/** Backend client for the OAuth CLI flow (ticket 03). */

export interface StartResponse {
  authorize_url: string;
  state: string;
}

export interface PollResponse {
  status: "pending" | "complete" | "error" | "expired";
  token?: string;
  login?: string;
  email?: string | null;
  error?: string;
}

/** POST /auth/cli/start — begin a browser sign-in. */
export async function startLogin(apiBase: string, fetchImpl: typeof fetch = fetch): Promise<StartResponse> {
  const res = await fetchImpl(`${apiBase}/auth/cli/start`, { method: "POST" });
  if (!res.ok) throw new Error(`login could not start (HTTP ${res.status})`);
  return (await res.json()) as StartResponse;
}

/** POST /auth/cli/poll — check whether the browser step has completed. */
export async function poll(apiBase: string, state: string, fetchImpl: typeof fetch = fetch): Promise<PollResponse> {
  const res = await fetchImpl(`${apiBase}/auth/cli/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  if (!res.ok && res.status !== 400) throw new Error(`login check failed (HTTP ${res.status})`);
  return (await res.json()) as PollResponse;
}

export type MarketingConsent = "unset" | "yes" | "no";

export interface WatchResponse {
  ok: boolean;
  slug: string;
  marketing_consent: MarketingConsent;
}

/** POST /watch — subscribe to a doc's updates (auth-gated, ticket 08). */
export async function registerWatch(
  apiBase: string,
  token: string,
  slug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WatchResponse> {
  const res = await fetchImpl(`${apiBase}/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ slug }),
  });
  if (res.status === 401) throw new Error("Your sign-in has expired. Run `graflet login` again.");
  if (res.status === 404) throw new Error(`No doc named "${slug}". Check the slug with the catalog.`);
  if (!res.ok) throw new Error(`watch failed (HTTP ${res.status})`);
  return (await res.json()) as WatchResponse;
}

export interface Resolve {
  version: string;
  repo_url: string;
  sha: string;
  docs_path: string | null;
  kg_ref: string | null;
}

/** GET /catalog/{slug}[?version=] — resolve the pin the CLI feeds codeload + the
 *  broker (ticket 05). Public (no auth). Returns null when the version is browsable
 *  but not yet deliverable (no recorded pin, e.g. the pre-P1 seeded state). */
export async function resolveDoc(
  apiBase: string,
  slug: string,
  version: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Resolve | null> {
  const res = await fetchImpl(`${apiBase}/catalog/${encodeURIComponent(slug)}${versionQuery(version)}`);
  if (res.status === 404) throw new Error(`No doc named "${slug}". Browse the catalog for the right slug.`);
  if (!res.ok) throw new Error(`could not resolve "${slug}" (HTTP ${res.status})`);
  return ((await res.json()) as { resolve: Resolve | null }).resolve;
}

/** GET /kg/{slug}[?version=] — the auth-gated KG download (ticket 05). Returns the
 *  bundle `.tar.gz` bytes and the sha the backend recorded with it (X-KG-Sha), so
 *  the caller can confirm the KG aligns with the .md snapshot (ADR-0002). */
export async function downloadKg(
  apiBase: string,
  token: string,
  slug: string,
  version: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; sha: string | null }> {
  const res = await fetchImpl(`${apiBase}/kg/${encodeURIComponent(slug)}${versionQuery(version)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Your sign-in has expired. Run `graflet login` again.");
  if (res.status === 404) throw new Error(`No downloadable KG for "${slug}"${version ? `@${version}` : ""} yet.`);
  if (!res.ok) throw new Error(`KG download failed (HTTP ${res.status})`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), sha: res.headers.get("X-KG-Sha") };
}

function versionQuery(version: string | null): string {
  return version ? `?version=${encodeURIComponent(version)}` : "";
}

/** POST /consent — record the marketing opt-in answer (ticket 08). */
export async function setConsent(
  apiBase: string,
  token: string,
  answer: "yes" | "no",
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${apiBase}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answer }),
  });
  if (!res.ok) throw new Error(`could not save your choice (HTTP ${res.status})`);
}
