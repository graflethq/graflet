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
