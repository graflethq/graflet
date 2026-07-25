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

export type Session = { login: string; consent: "yes" | "no" };

export const SESSION_KEY = "graflet:session";

/** The remembered session, or null — including when storage is unavailable
 *  (private mode, storage disabled) or holds something we didn't write. */
export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.login && (s.consent === "yes" || s.consent === "no") ? s : null;
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
