/**
 * Where the CLI keeps its bearer token (ticket 03).
 *
 * Order of preference, the gh/supabase pattern: the OS keyring, falling back to
 * a 0600 plaintext file where no keyring exists (headless Linux, containers).
 * The `--token`/env path (resolveToken) reads without ever writing either.
 */

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);

const SERVICE = "graflet";
const ACCOUNT = "token";
export const TOKEN_ENV = "GRAFLET_TOKEN";

/** A minimal secret store. Injected in tests; defaults to the OS keyring. */
export interface Keyring {
  get(): string | null; // null when absent; throws when no keyring backend exists
  set(value: string): void;
  delete(): void;
}

export interface StoreOptions {
  keyring?: Keyring;
  filePath?: string;
}

/** Persist the token: keyring first, plaintext file if the keyring is unavailable. */
export function saveToken(token: string, opts: StoreOptions = {}): void {
  const kr = opts.keyring ?? defaultKeyring();
  try {
    kr.set(token);
    return;
  } catch {
    // no keyring backend — fall through to the plaintext file
  }
  writeTokenFile(token, opts.filePath ?? defaultFile());
}

/** Read the stored token (keyring, then file). Returns null if signed out. */
export function loadToken(opts: StoreOptions = {}): string | null {
  const kr = opts.keyring ?? defaultKeyring();
  try {
    const v = kr.get();
    if (v) return v;
  } catch {
    // no keyring backend — try the file
  }
  return readTokenFile(opts.filePath ?? defaultFile());
}

/** Forget the token everywhere (keyring and file). Idempotent. */
export function clearToken(opts: StoreOptions = {}): void {
  const kr = opts.keyring ?? defaultKeyring();
  try {
    kr.delete();
  } catch {
    // no keyring / nothing stored — ignore
  }
  try {
    fs.rmSync(opts.filePath ?? defaultFile(), { force: true });
  } catch {
    // ignore
  }
}

/**
 * The token to authenticate a command with, without triggering a browser or a
 * keyring write: an explicit `--token`, then $GRAFLET_TOKEN, then whatever is
 * stored. Used by the download/watch commands (05/08).
 */
export function resolveToken(opts: StoreOptions & { flagToken?: string } = {}): string | null {
  if (opts.flagToken) return opts.flagToken;
  const fromEnv = process.env[TOKEN_ENV];
  if (fromEnv) return fromEnv;
  return loadToken(opts);
}

// --- plaintext fallback file (0600) ---------------------------------------

function defaultFile(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "graflet", "token");
}

function writeTokenFile(token: string, file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token, { mode: 0o600 });
  // writeFileSync's mode only applies on create; force it in case the file existed.
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best effort (e.g. Windows) — non-fatal
  }
}

function readTokenFile(file: string): string | null {
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    return v || null;
  } catch {
    return null;
  }
}

// --- default OS keyring (lazy-loaded native module) -----------------------

let cachedEntry: { getPassword(): string; setPassword(v: string): void; deletePassword(): boolean } | null = null;

function entry() {
  if (!cachedEntry) {
    // Lazy + synchronous: throws where @napi-rs/keyring has no prebuild, which
    // the callers above catch and turn into the plaintext-file fallback.
    const { Entry } = require("@napi-rs/keyring") as {
      Entry: new (service: string, account: string) => typeof cachedEntry & object;
    };
    cachedEntry = new Entry(SERVICE, ACCOUNT);
  }
  return cachedEntry!;
}

function defaultKeyring(): Keyring {
  return {
    get() {
      const e = entry(); // throws (→ file) if no keyring backend
      try {
        return e.getPassword();
      } catch {
        return null; // present but no entry stored
      }
    },
    set(value) {
      entry().setPassword(value);
    },
    delete() {
      try {
        entry().deletePassword();
      } catch {
        // nothing stored — fine
      }
    },
  };
}
