import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMonthlyActivityLite } = vi.hoisted(() => ({
  getMonthlyActivityLite: vi.fn(),
}));

vi.mock("@/lib/dashboard/lite-queries", () => ({
  getMonthlyActivityLite,
}));

import { GET } from "../route";

describe("GET /api/dashboard/monthly-activity", () => {
  beforeEach(() => {
    getMonthlyActivityLite.mockReset();
  });

  it("returns real monthly activity from the dashboard query layer", async () => {
    getMonthlyActivityLite.mockResolvedValue([
      { date: "2026-05-01", questionsAnswered: 2, cardsReviewed: 1, minutesStudied: 20 },
    ]);

    const response = await GET(new Request("https://example.test/api/dashboard/monthly-activity?year=2026&month=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getMonthlyActivityLite).toHaveBeenCalledWith({ year: 2026, month: 5 });
    expect(body).toEqual({
      activity: [{ date: "2026-05-01", questionsAnswered: 2, cardsReviewed: 1, minutesStudied: 20 }],
      year: 2026,
      month: 5,
    });
  });

  it("rejects invalid month parameters without querying fallback demo data", async () => {
    const response = await GET(new Request("https://example.test/api/dashboard/monthly-activity?year=2026&month=13"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(getMonthlyActivityLite).not.toHaveBeenCalled();
    expect(body).toEqual({ activity: [] });
  });
});
