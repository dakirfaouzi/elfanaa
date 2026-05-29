/**
 * Vitest setup — runs BEFORE every test module is evaluated.
 *
 * # Why a setup file (and not per-test stubs)
 *
 * Several modules in `apps/fanaa` are designed to run in a browser
 * (Zustand stores with `persist` middleware, hooks that read
 * `window`, the cart store's `createJSONStorage(() => localStorage)`
 * factory). When their MODULE-LEVEL code runs in Node it expects
 * `localStorage` and `window` to exist. Per-test stubs land too
 * late — ES module imports are hoisted above any test-file
 * statement, so by the time `beforeEach` fires, the modules under
 * test have already evaluated and captured `undefined`.
 *
 * A Vitest setup file runs in the same Node context BEFORE the
 * first test module loads, which means our globals are in place
 * when the persist middleware initialises its storage factory.
 *
 * # What we polyfill
 *
 *   • `localStorage` — in-memory map. Zustand `persist` middleware
 *     reads/writes synchronously, so this needs the full Storage
 *     surface (`getItem` / `setItem` / `removeItem` / `clear` /
 *     `key` / `length`).
 *
 *   • `window` — a minimal object with `addEventListener` /
 *     `removeEventListener` no-ops. Several hooks subscribe to
 *     storage events at module load.
 *
 * # Hermeticity
 *
 * Each test file is responsible for clearing the cart store (or
 * any other persisted store) in its own `beforeEach`. The memory
 * backing map persists across tests within a single file, which
 * matches real browser behaviour and makes "clear before each
 * test" the obvious safe default.
 */

import { vi } from "vitest";

const memoryStore = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memoryStore.set(k, v);
  },
  removeItem: (k: string) => {
    memoryStore.delete(k);
  },
  clear: () => memoryStore.clear(),
  key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
  get length() {
    return memoryStore.size;
  },
});

vi.stubGlobal("sessionStorage", {
  getItem: (_k: string) => null,
  setItem: (_k: string, _v: string) => {
    /* noop — receipts aren't exercised in pure unit tests */
  },
  removeItem: (_k: string) => {
    /* noop */
  },
  clear: () => {
    /* noop */
  },
  key: (_i: number) => null,
  length: 0,
});

vi.stubGlobal("window", {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: "http://localhost/" },
});
