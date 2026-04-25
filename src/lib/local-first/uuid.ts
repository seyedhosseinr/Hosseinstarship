/**
 * UUID v4 generator for local-first mutation IDs, local IDs, and reviews.
 *
 * Uses `crypto.randomUUID()` when available (browsers, Node 19+) and falls
 * back to the `uuid` package's v4 otherwise. All IDs must be UUID v4 —
 * NEVER use `Date.now()` or monotonic counters for mutation IDs: they
 * collide across tabs and lose ordering after clock skew.
 */

import { v4 as uuidV4Fallback } from "uuid";

export function uuidV4(): string {
  // Prefer the built-in crypto.randomUUID — available in all evergreen
  // browsers and in Node ≥ 19. It is spec-compliant UUID v4.
  const g = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return uuidV4Fallback();
}
