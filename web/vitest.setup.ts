import "@testing-library/jest-dom/vitest";

// jsdom under this vitest pool exposes no Storage — provide a minimal in-memory
// localStorage so the signup panel's session persistence (ticket 06) is testable.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const ls: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true });
  Object.defineProperty(window, "localStorage", { value: ls, configurable: true });
}
