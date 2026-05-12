import { beforeEach, describe, expect, it, vi } from "vitest";

import { syntheticDashboardStatsPayload } from "@/components/dashboard/__tests__/dashboard-synthetic-fixture";

const { getHostedDashboardLiteData } = vi.hoisted(() => ({
  getHostedDashboardLiteData: vi.fn(),
}));

vi.mock("@/lib/dashboard/lite-queries", () => ({
  getHostedDashboardLiteData,
}));

import { GET } from "../route";

describe("GET /api/dashboard/stats synthetic dashboard contract", () => {
  beforeEach(() => {
    getHostedDashboardLiteData.mockReset();
  });

  it("returns every slice needed by dashboard cards without demo fallback data", async () => {
    getHostedDashboardLiteData.mockResolvedValue(syntheticDashboardStatsPayload);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.qbank.totalAttempts).toBe(30);
    expect(body.flashcards.dueToday).toBe(9);
    expect(body.fsrsStatsByChapter).toHaveLength(3);
    expect(body.readerStatsByChapter).toHaveLength(3);
    expect(body.weeklyActivity).toHaveLength(2);
    expect(body.chapterPerformance.map((row: { chapterTitle: string }) => row.chapterTitle)).toContain(
      "Synthetic Weak Chapter",
    );
    expect(body.activityFeed.map((row: { type: string }) => row.type)).toEqual(["card_review", "mcq_block"]);
    expect(body.monthlyActivity).toHaveLength(3);
    expect(body.plannerDetailedStats.studyStreak).toBe(14);
    expect(body.detailedWeakAreas[0].label).toBe("Synthetic Weak Chapter");
  });
});

