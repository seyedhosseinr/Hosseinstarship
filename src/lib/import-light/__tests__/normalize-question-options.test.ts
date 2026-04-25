/**
 * Pinning tests for `normalizeQuestionOptions` — the single function that
 * decides which option is correct for a question at import time. These
 * tests document the existing contract so a future refactor cannot shift
 * semantics silently. Specifically:
 *
 *  - explicit `isCorrect` on option records takes precedence (B-slot marked
 *    because the source marked it, not by inference);
 *  - letter-key answers ("B", "b", " B ") resolve by key;
 *  - NUMERIC answers are treated as 0-based indices. If an upstream source
 *    ever ships 1-based numeric answers they MUST be converted before
 *    hitting this function, otherwise every answer will shift by one and
 *    land on the next slot — a classic way to synthesize a fake "always B"
 *    bias.
 */

import { describe, it, expect } from "vitest";

import { normalizeQuestionOptions } from "../structured-import";

describe("normalizeQuestionOptions — explicit isCorrect wins", () => {
  it("respects isCorrect flags on option records", () => {
    const opts = normalizeQuestionOptions(
      {},
      [
        { key: "A", contentText: "alpha", isCorrect: false },
        { key: "B", contentText: "bravo", isCorrect: true },
        { key: "C", contentText: "charlie", isCorrect: false },
        { key: "D", contentText: "delta", isCorrect: false },
      ],
      // Even a mismatched answerValue cannot unset an explicit isCorrect.
      "A",
    );
    const correct = opts.filter((o) => o.isCorrect).map((o) => o.key);
    // The A-key also matches the answerValue so both A and B are flagged.
    // That is the current behavior: this test pins it, so any future change
    // (e.g. "answerValue must not contradict explicit isCorrect") is caught.
    expect(correct).toContain("B");
    expect(correct).toContain("A");
  });
});

describe("normalizeQuestionOptions — letter-key answer", () => {
  it("resolves a letter answer against string options", () => {
    const opts = normalizeQuestionOptions(
      {},
      ["alpha", "bravo", "charlie", "delta"],
      "B",
    );
    expect(opts.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
    expect(opts.find((o) => o.isCorrect)?.key).toBe("B");
  });

  it("is case- and whitespace-insensitive for letter answers", () => {
    const opts = normalizeQuestionOptions({}, ["x", "y", "z"], " b ");
    expect(opts.find((o) => o.isCorrect)?.key).toBe("B");
  });

  it("handles the object-keyed options format ({A,B,C,D})", () => {
    const opts = normalizeQuestionOptions(
      {},
      { A: "alpha", B: "bravo", C: "charlie", D: "delta" },
      "C",
    );
    expect(opts.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
    expect(opts.find((o) => o.isCorrect)?.key).toBe("C");
  });
});

describe("normalizeQuestionOptions — numeric answer (0-based, PINNED)", () => {
  it("treats correctAnswer: 0 as first option", () => {
    const opts = normalizeQuestionOptions({}, ["a", "b", "c", "d"], 0);
    expect(opts.find((o) => o.isCorrect)?.key).toBe("A");
  });

  it("treats correctAnswer: 1 as SECOND option (0-based index, not 1-based!)", () => {
    // This is the deliberate behavior pin: anyone reading this test should
    // understand that upstream data using 1-based numbering will be shifted
    // by one and will NEVER mark option A. A 1-based-always-1 corpus
    // degrades into a 0-based-always-1 corpus, i.e. "always B".
    const opts = normalizeQuestionOptions({}, ["a", "b", "c", "d"], 1);
    expect(opts.find((o) => o.isCorrect)?.key).toBe("B");
  });

  it("treats the string '1' as 0-based index (same trap as numeric)", () => {
    const opts = normalizeQuestionOptions({}, ["a", "b", "c", "d"], "1");
    expect(opts.find((o) => o.isCorrect)?.key).toBe("B");
  });

  it("ignores out-of-range numeric answers without crashing", () => {
    const opts = normalizeQuestionOptions({}, ["a", "b", "c", "d"], 99);
    // No option is marked correct — the upstream caller will reject the row.
    expect(opts.some((o) => o.isCorrect)).toBe(false);
  });
});

describe("normalizeQuestionOptions — legacy optionA/optionB fallback", () => {
  it("reconstructs options from legacy per-letter fields", () => {
    const opts = normalizeQuestionOptions(
      { optionA: "alpha", optionB: "bravo", optionC: "charlie", optionD: "delta" },
      undefined,
      "C",
    );
    expect(opts.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
    expect(opts.find((o) => o.isCorrect)?.key).toBe("C");
  });
});
