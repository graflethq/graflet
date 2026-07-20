import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { saveToken, loadToken, clearToken, resolveToken, TOKEN_ENV, type Keyring } from "./credential-store";

// An in-memory keyring (a working OS keyring).
function memKeyring(): { kr: Keyring; peek: () => string | null } {
  let v: string | null = null;
  return {
    kr: { get: () => v, set: (x) => void (v = x), delete: () => void (v = null) },
    peek: () => v,
  };
}

// A keyring backend that isn't there (headless Linux, container) — everything throws.
const noKeyring: Keyring = {
  get() {
    throw new Error("no keyring");
  },
  set() {
    throw new Error("no keyring");
  },
  delete() {
    throw new Error("no keyring");
  },
};

let tmpFile: string;
beforeEach(() => {
  tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dkg-")), "token");
  delete process.env[TOKEN_ENV];
});

describe("credential store (ticket 03)", () => {
  it("uses the keyring when one exists — and writes no file", () => {
    const { kr, peek } = memKeyring();
    saveToken("tok_abc", { keyring: kr, filePath: tmpFile });

    expect(peek()).toBe("tok_abc");
    expect(fs.existsSync(tmpFile)).toBe(false);
    expect(loadToken({ keyring: kr, filePath: tmpFile })).toBe("tok_abc");

    clearToken({ keyring: kr, filePath: tmpFile });
    expect(loadToken({ keyring: kr, filePath: tmpFile })).toBeNull();
  });

  it("falls back to a 0600 plaintext file when there is no keyring", () => {
    saveToken("tok_file", { keyring: noKeyring, filePath: tmpFile });

    expect(fs.existsSync(tmpFile)).toBe(true);
    expect(fs.statSync(tmpFile).mode & 0o777).toBe(0o600);
    expect(loadToken({ keyring: noKeyring, filePath: tmpFile })).toBe("tok_file");

    clearToken({ keyring: noKeyring, filePath: tmpFile });
    expect(fs.existsSync(tmpFile)).toBe(false);
    expect(loadToken({ keyring: noKeyring, filePath: tmpFile })).toBeNull();
  });

  it("resolveToken prefers --token, then env, then stored — and never writes the keyring", () => {
    // --token wins over everything
    expect(resolveToken({ flagToken: "flagtok", keyring: noKeyring, filePath: tmpFile })).toBe("flagtok");

    // env is next
    process.env[TOKEN_ENV] = "envtok";
    expect(resolveToken({ keyring: noKeyring, filePath: tmpFile })).toBe("envtok");
    delete process.env[TOKEN_ENV];

    // stored is last
    saveToken("stored", { keyring: noKeyring, filePath: tmpFile });
    expect(resolveToken({ keyring: noKeyring, filePath: tmpFile })).toBe("stored");

    // the --token / env path must not write the keyring
    const writes: string[] = [];
    const spyKeyring: Keyring = { get: () => null, set: (v) => void writes.push(v), delete: () => {} };
    process.env[TOKEN_ENV] = "envtok2";
    resolveToken({ flagToken: "flagtok", keyring: spyKeyring, filePath: tmpFile });
    resolveToken({ keyring: spyKeyring, filePath: tmpFile });
    expect(writes).toEqual([]);
  });
});
