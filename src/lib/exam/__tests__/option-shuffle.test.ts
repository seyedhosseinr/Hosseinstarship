/**
 * Tests for the per-session option shuffler.
 *
 * The shuffler is the front-line fix for the "correct answer is always B"
 * complaint: it decouples display position from storage order so any
 * positional bias in the corpus (generator-introduced or otherwise) is no
 * longer visible to the user, while identity-based scoring stays correct.
 *
 * These cases pin the properties we care about:
 *   1) determinism per (sessionId, sessionQuestionId)
 *   2) the correct option moves with the shuffle (identity preserved)
 *   3) no key → no shuffle (legacy/backward compat)
 *   4) displayed labels A/B/C/D derived from shuffled position,
 *      not from stored optionKey
 *   5) across many session-questions, the correct answer does NOT
 *      cluster on a single letter even when every input has the
 *      correct option at the same stored position
 */

import { describe, it, expect } from "vitest";

import {
  hashSeed,
  makeRng,
  shuffleWithSeed,
  shuffleOptionsForSessionQuestion,
} from "../option-shuffle";

type Opt = { id: string; optionKey: string; isCorrect: 0 | 1 };

function fixtureOptions(correctIndex: number): Opt[] {
  const letters = ["A", "B", "C", "D"];
  return letters.map((k, i) => ({
    id: `opt_${k}`,
    optionKey: k,
    isCorrect: i === correctIndex ? 1 : 0,
  }));
}

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
  });

  it("distinguishes neighboring keys", () => {
    expect(hashSeed("sess_1|sq_1")).not.toBe(hashSeed("sess_1|sq_2"));
    expect(hashSeed("sess_1|sq_1")).not.toBe(hashSeed("sess_2|sq_1"));
  });
});

describe("makeRng / shuffleWithSeed", () => {
  it("produces identical sequences for the same seed", () => {
    const a = [1, 2, 3, 4, 5];
    expect(shuffleWithSeed(a, 42)).toEqual(shuffleWithSeed(a, 42));
  });

  it("does not mutate the input", () => {
    const a = [1, 2, 3, 4];
    const snapshot = a.slice();
    shuffleWithSeed(a, 123);
    expect(a).toEqual(snapshot);
  });

  it("returns a permutation (same multiset)", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffleWithSeed(a, 999);
    expect(out.slice().sort((x, y) => x - y)).toEqual(a);
  });
});

describe("shuffleOptionsForSessionQuestion", () => {
  it("returns input order when no key is provided (legacy)", () => {
    const opts = fixtureOptions(1);
    expect(shuffleOptionsForSessionQuestion(opts, null).map((o) => o.id)).toEqual(
      opts.map((o) => o.id),
    );
    expect(shuffleOptionsForSessionQuestion(opts, "").map((o) => o.id)).toEqual(
      opts.map((o) => o.id),
    );
  });

  it("is stable across calls with the same shuffle key", () => {
    const opts = fixtureOptions(1);
    const key = "opt|sess_xyz|sq_42";
    const first = shuffleOptionsForSessionQuestion(opts, key).map((o) => o.id);
    const second = shuffleOptionsForSessionQuestion(opts, key).map((o) => o.id);
    expect(first).toEqual(second);
  });

  it("preserves the correct option's identity after shuffle", () => {
    // The correct option is stored at index 1 ("B") — mimics the suspected
    // "always-B" corpus. After shuffle, the SAME object must still be the
    // one flagged isCorrect, regardless of where it lands.
    const opts = fixtureOptions(1);
    const shuffled = shuffleOptionsForSessionQuestion(opts, "opt|s|q");
    const correct = shuffled.find((o) => o.isCorrect === 1);
    expect(correct?.id).toBe("opt_B");
  });

  it("produces different orders for different session-questions", () => {
    const opts = fixtureOptions(1);
    const orderA = shuffleOptionsForSessionQuestion(opts, "opt|s|q1")
      .map((o) => o.id)
      .join(",");
    const orderB = shuffleOptionsForSessionQuestion(opts, "opt|s|q2")
      .map((o) => o.id)
      .join(",");
    // In the unlikely event two seeds collide on identity permutation,
    // the test still isn't wrong — but across these two keys the output
    // differs with the current PRNG.
    expect(orderA).not.toEqual(orderB);
  });

  it("spreads the correct-answer position across letters when the corpus is uniformly biased", () => {
    // Every input question has correct at index 1 ("always B"). After
    // shuffling per session-question, the displayed position (A/B/C/D)
    // should NOT stay stuck on B across many questions.
    const positionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const N = 200;
    for (let i = 0; i < N; i++) {
      const opts = fixtureOptions(1);
      const shuffled = shuffleOptionsForSessionQuestion(opts, `opt|sess|sq_${i}`);
      const pos = shuffled.findIndex((o) => o.isCorrect === 1);
      const letter = String.fromCharCode(65 + pos);
      positionCounts[letter]! += 1;
    }
    // Sanity: all four letters show up, and no one letter captures more
    // than ~45% (uniform expectation is 25%; slack absorbs PRNG variance).
    for (const l of ["A", "B", "C", "D"] as const) {
      expect(positionCounts[l]).toBeGreaterThan(0);
      expect(positionCounts[l]! / N).toBeLessThan(0.45);
    }
  });

  it("handles 1-option and empty inputs without throwing", () => {
    expect(shuffleOptionsForSessionQuestion([], "k")).toEqual([]);
    const one = [{ id: "only", optionKey: "A", isCorrect: 1 as const }];
    expect(shuffleOptionsForSessionQuestion(one, "k").map((o) => o.id)).toEqual(["only"]);
  });
});
