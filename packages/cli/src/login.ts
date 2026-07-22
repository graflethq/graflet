/**
 * `docs-kg login` / `docs-kg logout` (ticket 03).
 *
 * login: start the flow, open the browser, poll until the backend has minted a
 * token, then store it. It NEVER prompts for marketing consent — sign-in is
 * identity only (ADR-0006); consent is a later, deliberate action (07/08).
 */

import { startLogin, poll } from "./api.js";
import { saveToken, clearToken } from "./credential-store.js";

export interface LoginDeps {
  apiBase: string;
  fetchImpl?: typeof fetch;
  openBrowser?: (url: string) => void;
  save?: (token: string) => void;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
  now?: () => number;
  intervalMs?: number;
  timeoutMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Returns a process exit code (0 = signed in). */
export async function login(deps: LoginDeps): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const openBrowser = deps.openBrowser ?? (() => {});
  const save = deps.save ?? ((t: string) => saveToken(t));
  const sleep = deps.sleep ?? realSleep;
  const log = deps.log ?? console.log;
  const now = deps.now ?? Date.now;
  const intervalMs = deps.intervalMs ?? 2000;
  const timeoutMs = deps.timeoutMs ?? 10 * 60 * 1000;

  const { authorize_url, state } = await startLogin(deps.apiBase, fetchImpl);
  log("Opening your browser to sign in with GitHub…");
  log(`If it doesn't open, visit:\n  ${authorize_url}`);
  openBrowser(authorize_url);

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await sleep(intervalMs);
    const r = await poll(deps.apiBase, state, fetchImpl);
    if (r.status === "complete") {
      save(r.token!);
      log(`Signed in as ${r.login}.`);
      return 0;
    }
    if (r.status === "error") {
      log(`Sign-in failed: ${r.error ?? "unknown error"}`);
      return 1;
    }
    if (r.status === "expired") {
      log("Sign-in link expired. Run `docs-kg login` again.");
      return 1;
    }
    // pending — keep waiting
  }
  log("Timed out waiting for sign-in.");
  return 1;
}

export interface LogoutDeps {
  clear?: () => void;
  log?: (msg: string) => void;
}

/** Forget the stored token (keyring + plaintext). Returns an exit code. */
export function logout(deps: LogoutDeps = {}): number {
  (deps.clear ?? (() => clearToken()))();
  (deps.log ?? console.log)("Signed out.");
  return 0;
}
