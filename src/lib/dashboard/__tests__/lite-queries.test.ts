import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/index", () => ({
  getDb: vi.fn(),
}));

import { buildMonthlyActivityRows } from "../lite-queries";

describe("buildMonthlyActivityRows", () => {
  it("aggregates real MCQ, FSRS, planner, and reader activity by day", () => {
    const start = new Date(2026, 4, 1).getTime();
    const end = new Date(2026, 4, 3).getTime();
    const may1Noon = new Date(2026, 4, 1, 12).getTime();
    const may2Noon = new Date(2026, 4, 2, 12).getTime();

    const rows = buildMonthlyActivityRows(start, end, {
      questions: [
        { attemptedAt: may1Noon, timeSpentSeconds: 120 },
        { attemptedAt: may1Noon + 1000, timeSpentSeconds: 30 },
      ],
      reviews: [{ reviewedAt: may1Noon }],
      tasks: [{ completedAt: may2Noon, actualMinutes: 45 }],
      chunks: [{ startedAt: may2Noon, durationSeconds: 600 }],
    });

    expect(rows).toEqual([
      { date: "2026-05-01", questionsAnswered: 2, cardsReviewed: 1, minutesStudied: 3 },
      { date: "2026-05-02", questionsAnswered: 0, cardsReviewed: 0, minutesStudied: 55 },
    ]);
  });

  it("keeps empty days as zero rows instead of inventing demo activity", () => {
    const start = new Date(2026, 4, 1).getTime();
    const end = new Date(2026, 4, 2).getTime();

    expect(
      buildMonthlyActivityRows(start, end, {
        questions: [],
        reviews: [],
        tasks: [],
        chunks: [],
      }),
    ).toEqual([
      { date: "2026-05-01", questionsAnswered: 0, cardsReviewed: 0, minutesStudied: 0 },
    ]);
  });
});
