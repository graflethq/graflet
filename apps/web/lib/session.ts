/**
 * The browser's memory of who signed in — read by the nav and by the join panel,
 * so it is defined once here rather than in whichever component happened to need
 * it first.
 *
 * It is a *local* memory and nothing more. The website OAuth flow mints no token
 * (ADR-0001: the exchange runs server-side and hands back `#login=&consent=`, never
 * a credential), so this grants no access to anything — it only spares an already-
 * answered user from being re-prompted (ADR-0006). Signing out therefore clears
 * this and nothing else; there is no server-side session to end.
 */

/**
 * `github_id` is optional because sessions written before ticket 05 don't carry it.
 * Those stay perfectly valid — the holder just isn't identified to PostHog until
 * their next sign-in, which is a better outcome than logging everyone out.
 */
export type Session = { login: string; consent: "yes" | "no"; github_id?: number };

export const SESSION_KEY = "graflet:session";

/**
 * One rule for "is this a usable GitHub account id", used by both the writer (the
 * OAuth callback fragment) and the reader. Two rules would let a value the writer
 * rejects survive in storage and reach `identify()` on the next load.
 */
export function isGithubId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

/** The remembered session, or null — including when storage is unavailable
 *  (private mode, storage disabled) or holds something we didn't write. */
export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.login || (s.consent !== "yes" && s.consent !== "no")) return null;
    // A junk github_id is dropped rather than failing the whole session: it only
    // drives analytics, and a bad one would key a person on garbage.
    return isGithubId(s.github_id) ? s : { login: s.login, consent: s.consent };
  } catch {
    return null;
  }
}

export function writeSession(s: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Storage refused — the sign-in still happened server-side, we just won't
    // remember it here. Never a reason to fail the flow.
  }
}

/** Forget this browser. Consent stays as recorded server-side: it answers a
 *  question about email, which signing out of a browser doesn't change. */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage was never readable.
  }
}
