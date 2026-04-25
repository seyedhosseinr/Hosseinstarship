/**
 * Deterministic, per-session option shuffler.
 *
 * Why this exists
 * ---------------
 * Correctness in QBank is identity-based (selectedOptionId === correctOptionId),
 * not index-based. Nothing in the scoring pipeline depends on display order.
 * However the app historically rendered options in stored sortOrder, with the
 * label (A/B/C/D) assigned by position. Any positional bias in the imported
 * corpus (for example a generator that tends to place the correct answer in
 * slot B) therefore leaked straight through to the user.
 *
 * This module decouples display order from storage order. The shuffle is:
 *  - deterministic per (examSessionId, sessionQuestionId) so a user who refreshes
 *    mid-exam sees the same layout;
 *  - independent of the stored correctness key — we permute option IDs and the
 *    caller re-derives display letters from the new position;
 *  - safe for legacy data: when no key is provided, order is unchanged.
 *
 * This does NOT fix corpus bias — it hides it from the user and removes the
 * positional cue. For measuring the underlying distribution, see
 * `src/lib/qbank/audit.ts`.
 */

/**
 * Stable 32-bit hash over a string. FNV-1a with a small epilogue mix so
 * small inputs still produce well-distributed seeds. Pure function; no
 * dependency on host crypto so it runs identically in Node and the browser.
 */
export function hashSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // epilogue mix
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Mulberry32 PRNG — small, fast, good enough for shuffling 4–8 options.
 * Seeded by hashSeed() so the permutation is reproducible.
 */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded PRNG. Returns a new array; the input
 * is not mutated.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rng = makeRng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle options for a given session-question. When `shuffleKey` is empty
 * or null, returns the input unchanged so legacy callers stay backward
 * compatible.
 */
export function shuffleOptionsForSessionQuestion<
  T extends { id: string },
>(options: readonly T[], shuffleKey: string | null | undefined): T[] {
  if (!shuffleKey) return options.slice();
  if (options.length <= 1) return options.slice();
  return shuffleWithSeed(options, hashSeed(shuffleKey));
}
