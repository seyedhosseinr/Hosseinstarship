/**
 * Tests for the QBank corpus audit.
 *
 * The audit measures where the correct option sits in the stored display
 * order across every active question. It is the diagnostic we use to tell
 * apart TRUE corpus bias from an APP-LEVEL mapping bug: if the import data
 * itself always puts the correct answer at index 1, the audit will flag
 * "always B" regardless of what the runtime does.
 */

import { describe, it, expect } from "vitest";

import {
  computeCorrectAnswerDistribution,
  type OptionRowLike,
} from "../audit";

function makeQuestion(qid: string, correctIndex: number): OptionRowLike[] {
  return ["A", "B", "C", "D"].map((k, i) => ({
    questionId: qid,
    optionKey: k,
    isCorrect: i === correctIndex ? 1 : 0,
    sortOrder: i,
  }));
}

describe("computeCorrectAnswerDistribution", () => {
  it("returns a uniform distribution for a balanced corpus", () => {
    const rows: OptionRowLike[] = [];
    const qids: string[] = [];
    for (let i = 0; i < 40; i++) {
      const qid = `q_${i}`;
      qids.push(qid);
      rows.push(...makeQuestion(qid, i % 4));
    }
    const dist = computeCorrectAnswerDistribution(rows, qids);
    expect(dist.totalWithCorrect).toBe(40);
    expect(dist.counts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(dist.maxShare).toBe(25);
  });

  it("flags a strong positional bias", () => {
    const rows: OptionRowLike[] = [];
    const qids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const qid = `q_${i}`;
      qids.push(qid);
      // always-B corpus
      rows.push(...makeQuestion(qid, 1));
    }
    const dist = computeCorrectAnswerDistribution(rows, qids);
    expect(dist.maxKey).toBe("B");
    expect(dist.maxShare).toBe(100);
    expect(dist.counts.B).toBe(50);
  });

  it("uses positional order, not stored optionKey", () => {
    // Question has its options stored with a non-alphabetic optionKey
    // scheme but sortOrder still determines display position. The audit
    // must report the POSITION letter (A=first displayed).
    const qid = "q_oddkeys";
    const rows: OptionRowLike[] = [
      { questionId: qid, optionKey: "Z", isCorrect: 1, sortOrder: 0 },
      { questionId: qid, optionKey: "Y", isCorrect: 0, sortOrder: 1 },
      { questionId: qid, optionKey: "X", isCorrect: 0, sortOrder: 2 },
      { questionId: qid, optionKey: "W", isCorrect: 0, sortOrder: 3 },
    ];
    const dist = computeCorrectAnswerDistribution(rows, [qid]);
    expect(dist.counts).toEqual({ A: 1 });
    expect(dist.maxKey).toBe("A");
  });

  it("ignores questions with no correct option", () => {
    const qid = "q_broken";
    const rows: OptionRowLike[] = [
      { questionId: qid, optionKey: "A", isCorrect: 0, sortOrder: 0 },
      { questionId: qid, optionKey: "B", isCorrect: 0, sortOrder: 1 },
    ];
    const dist = computeCorrectAnswerDistribution(rows, [qid]);
    expect(dist.totalWithCorrect).toBe(0);
    expect(dist.totalQuestions).toBe(1);
  });

  it("returns a safe empty report when given no questions", () => {
    const dist = computeCorrectAnswerDistribution([], []);
    expect(dist).toEqual({
      counts: {},
      totalWithCorrect: 0,
      totalQuestions: 0,
      maxShare: 0,
      maxKey: null,
    });
  });
});
