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
  if (res.status === 401) throw new Error("Your sign-in has expired. Run `docs-kg login` again.");
  if (res.status === 404) throw new Error(`No doc named "${slug}". Check the slug with the catalog.`);
  if (!res.ok) throw new Error(`watch failed (HTTP ${res.status})`);
  return (await res.json()) as WatchResponse;
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
