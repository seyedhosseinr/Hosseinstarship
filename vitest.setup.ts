/**
 * Vitest setup — wires fake-indexeddb as the global IndexedDB so Dexie can
 * open its stores under jsdom. Also resets the IDB state between tests so
 * each test starts from a clean database.
 */
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — fake-indexeddb has no types for subpath imports in strict mode
import { IDBFactory } from "fake-indexeddb";

afterEach(() => {
  // Swap in a fresh IDB factory so every test starts empty.
  // This is the sanctioned reset approach per the fake-indexeddb README.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});
