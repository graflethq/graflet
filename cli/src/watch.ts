/**
 * `docs-kg watch <slug>` (ticket 08).
 *
 * Subscribe to a doc's updates. Watching is auth-gated (ADR-0005) — signed out,
 * it tells the user to log in and stops. Because CLI notification-setup is one of
 * the two consent-capture points (ADR-0006), the FIRST time a user watches — and
 * only while their marketing_consent is still 'unset' — it shows a single
 * unchecked opt-in prompt (declines by default), records the answer, and never
 * asks again.
 */

import { registerWatch, setConsent } from "./api.js";
import { resolveToken } from "./credential-store.js";

export interface WatchDeps {
  apiBase: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null;
  // Returns the user's answer, or null when there's no interactive terminal to
  // ask on (piped/CI) — in which case consent is left 'unset', not recorded.
  prompt?: (question: string) => Promise<string | null>;
  log?: (msg: string) => void;
}

/** Returns a process exit code (0 = watching). */
export async function watch(slug: string, deps: WatchDeps): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getToken = deps.getToken ?? (() => resolveToken());
  const prompt = deps.prompt ?? (async () => null);
  const log = deps.log ?? console.log;

  if (!slug) {
    log("Usage: docs-kg watch <slug>");
    return 1;
  }

  const token = getToken();
  if (!token) {
    log("Watching a doc needs a sign-in. Run `docs-kg login` first.");
    return 1;
  }

  const { marketing_consent } = await registerWatch(deps.apiBase, token, slug, fetchImpl);
  log(`Watching ${slug}. You'll be emailed when a new version's graph is ready.`);

  // Consent is captured once, here, only if still unset (ADR-0006).
  if (marketing_consent === "unset") {
    const answer = await prompt("Also email you occasionally about new docs-kg features? [y/N] ");
    // No terminal to ask on (CI/piped): leave consent unset so a later
    // interactive watch or the website can still capture it — don't burn the
    // one-time opt-in on a silent 'no' (ADR-0006).
    if (answer !== null) {
      const yes = /^y(es)?$/i.test(answer.trim());
      await setConsent(deps.apiBase, token, yes ? "yes" : "no", fetchImpl);
      log(yes ? "Thanks — you're on the list." : "No problem — you'll only get watch notifications.");
    }
  }

  return 0;
}
