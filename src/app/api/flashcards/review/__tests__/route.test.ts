/**
 * Regression tests for the chapter-scoped review API route.
 *
 * Pins the contract that GET /api/flashcards/review?chapter=149:
 *   - parses the chapter param via the canonical normalizer
 *   - passes the resulting integer to listManagedDueFlashcards
 *   - passes it to countDueFlashcards
 *   - returns the chapter in the JSON payload
 *
 * Also verifies that no chapter param means global review (chapterNo=undefined).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { syntheticReviewCards } from "@/components/dashboard/__tests__/dashboard-synthetic-fixture";

const listMock = vi.fn();
const countMock = vi.fn();
let reviewCardsMock: unknown[] = [];
let totalDueMock = 0;

vi.mock("@/lib/services/flashcard-service", () => ({
  listManagedDueFlashcards: (limit: number, chapterNo?: number) => {
    listMock(limit, chapterNo);
    return Promise.resolve(reviewCardsMock.slice(0, limit));
  },
  reviewManagedFlashcard: vi.fn(),
  undoLastManagedReview: vi.fn(),
}));

vi.mock("@/lib/flashcards/queries", () => ({
  countDueFlashcards: (chapterNo?: number | null) => {
    countMock(chapterNo);
    return Promise.resolve(totalDueMock);
  },
}));

import { GET } from "../route";

beforeEach(() => {
  listMock.mockClear();
  countMock.mockClear();
  reviewCardsMock = [];
  totalDueMock = 0;
});

async function callGet(url: string) {
  const res = await GET(new Request(url));
  return res.json() as Promise<{ ok: boolean; chapter?: number | null; cards: unknown[]; totalDue: number }>;
}

describe("GET /api/flashcards/review chapter scoping", () => {
  it("passes chapterNo=149 to both loaders when ?chapter=149", async () => {
    const body = await callGet("https://example.test/api/flashcards/review?chapter=149&limit=100");
    expect(listMock).toHaveBeenCalledWith(100, 149);
    expect(countMock).toHaveBeenCalledWith(149);
    expect(body.ok).toBe(true);
    expect(body.chapter).toBe(149);
  });

  it("treats missing chapter param as global review (undefined / null)", async () => {
    await callGet("https://example.test/api/flashcards/review?limit=50");
    expect(listMock).toHaveBeenCalledWith(50, undefined);
    expect(countMock).toHaveBeenCalledWith(null);
  });

  it("treats malformed chapter param as global review (does NOT leak global+chapter mix)", async () => {
    await callGet("https://example.test/api/flashcards/review?chapter=&limit=10");
    expect(listMock).toHaveBeenCalledWith(10, undefined);
    expect(countMock).toHaveBeenCalledWith(null);

    listMock.mockClear();
    countMock.mockClear();

    await callGet("https://example.test/api/flashcards/review?chapter=all");
    expect(listMock.mock.calls[0]?.[1]).toBeUndefined();
    expect(countMock.mock.calls[0]?.[0]).toBeNull();
  });

  it("normalizes Persian-encoded chapter values from query strings", async () => {
    // Persian numerals or "فصل 149" forms decode through the normalizer.
    const url = `https://example.test/api/flashcards/review?chapter=${encodeURIComponent("فصل 149")}`;
    await callGet(url);
    expect(listMock).toHaveBeenCalledWith(100, 149);
    expect(countMock).toHaveBeenCalledWith(149);
  });

  it("returns the synthetic dashboard review queue contract for limit=4", async () => {
    reviewCardsMock = syntheticReviewCards;
    totalDueMock = syntheticReviewCards.length;

    const body = await callGet("https://example.test/api/flashcards/review?limit=4");

    expect(listMock).toHaveBeenCalledWith(4, undefined);
    expect(countMock).toHaveBeenCalledWith(null);
    expect(body.totalDue).toBe(syntheticReviewCards.length);
    expect(body.cards).toEqual(syntheticReviewCards);
  });
});
