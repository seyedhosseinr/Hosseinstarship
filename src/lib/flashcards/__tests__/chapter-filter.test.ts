import { describe, expect, it } from "vitest";
import {
  filterFlashcardsByChapter,
  flashcardMatchesChapter,
  getFlashcardChapterKey,
  normalizeChapterKey,
} from "../chapter-filter";

describe("normalizeChapterKey", () => {
  it("returns null for empty/null/undefined inputs", () => {
    expect(normalizeChapterKey(null)).toBe(null);
    expect(normalizeChapterKey(undefined)).toBe(null);
    expect(normalizeChapterKey("")).toBe(null);
    expect(normalizeChapterKey("   ")).toBe(null);
  });

  it("normalizes plain integers and numeric strings to '149'", () => {
    expect(normalizeChapterKey(149)).toBe("149");
    expect(normalizeChapterKey("149")).toBe("149");
    expect(normalizeChapterKey(" 149 ")).toBe("149");
  });

  it("rejects non-positive numbers", () => {
    expect(normalizeChapterKey(0)).toBe(null);
    expect(normalizeChapterKey(-3)).toBe(null);
    expect(normalizeChapterKey(NaN)).toBe(null);
    expect(normalizeChapterKey(Infinity)).toBe(null);
  });

  it("strips Persian and English chapter prefixes", () => {
    expect(normalizeChapterKey("Chapter 149")).toBe("149");
    expect(normalizeChapterKey("ch. 149")).toBe("149");
    expect(normalizeChapterKey("فصل 149")).toBe("149");
    expect(normalizeChapterKey("# فصل 149")).toBe("149");
  });

  it("converts Persian and Arabic-Indic digits to ASCII", () => {
    expect(normalizeChapterKey("۱۴۹")).toBe("149");
    expect(normalizeChapterKey("فصل ۱۴۹")).toBe("149");
    expect(normalizeChapterKey("١٤٩")).toBe("149");
  });

  it("returns null for strings with no digits", () => {
    expect(normalizeChapterKey("all")).toBe(null);
    expect(normalizeChapterKey("فصل")).toBe(null);
    expect(normalizeChapterKey("nope")).toBe(null);
  });

  it("normalizes equivalently across all accepted formats", () => {
    const formats = ["149", 149, "Chapter 149", "فصل 149", "# فصل 149", "۱۴۹", "فصل ۱۴۹"];
    const keys = formats.map(normalizeChapterKey);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("149");
  });
});

describe("getFlashcardChapterKey", () => {
  it("reads the canonical chapterNo field", () => {
    expect(getFlashcardChapterKey({ chapterNo: 149 })).toBe("149");
    expect(getFlashcardChapterKey({ chapterNo: 150 })).toBe("150");
  });

  it("falls back to snake_case chapter_no for local-first cards", () => {
    expect(getFlashcardChapterKey({ chapter_no: 146 })).toBe("146");
  });

  it("returns null for cards with no chapter assigned", () => {
    expect(getFlashcardChapterKey({ chapterNo: null })).toBe(null);
    expect(getFlashcardChapterKey({})).toBe(null);
  });
});

describe("flashcardMatchesChapter", () => {
  it("matches every card when no chapter is selected", () => {
    expect(flashcardMatchesChapter({ chapterNo: 149 }, null)).toBe(true);
    expect(flashcardMatchesChapter({ chapterNo: null }, null)).toBe(true);
    expect(flashcardMatchesChapter({ chapterNo: 150 }, "")).toBe(true);
  });

  it("matches only cards from the selected chapter", () => {
    expect(flashcardMatchesChapter({ chapterNo: 149 }, "149")).toBe(true);
    expect(flashcardMatchesChapter({ chapterNo: 150 }, "149")).toBe(false);
    expect(flashcardMatchesChapter({ chapterNo: 146 }, "149")).toBe(false);
  });

  it("never matches a chapter-less card against a chapter-scoped selector", () => {
    expect(flashcardMatchesChapter({ chapterNo: null }, "149")).toBe(false);
    expect(flashcardMatchesChapter({}, "149")).toBe(false);
  });

  it("treats numeric and string selectors equivalently", () => {
    expect(flashcardMatchesChapter({ chapterNo: 149 }, 149)).toBe(true);
    expect(flashcardMatchesChapter({ chapterNo: 149 }, "Chapter 149")).toBe(true);
    expect(flashcardMatchesChapter({ chapterNo: 149 }, "فصل 149")).toBe(true);
  });
});

describe("filterFlashcardsByChapter — mixed-chapter fixtures", () => {
  // Mirror the bug report: a queue containing 149, 150, 146 must
  // produce only 149 cards when scoped to chapter 149.
  type Card = { id: string; chapterNo: number | null };
  const cards: Card[] = [
    { id: "A", chapterNo: 149 },
    { id: "B", chapterNo: 150 },
    { id: "C", chapterNo: 146 },
    { id: "D", chapterNo: 149 },
    { id: "E", chapterNo: null },
  ];

  it("returns only chapter 149 cards when selectedChapter='149'", () => {
    const result = filterFlashcardsByChapter(cards, "149");
    expect(result.map((c) => c.id)).toEqual(["A", "D"]);
  });

  it("does NOT leak chapter 150 cards into a chapter 149 queue", () => {
    const result = filterFlashcardsByChapter(cards, "149");
    expect(result.some((c) => c.chapterNo === 150)).toBe(false);
    expect(result.some((c) => c.chapterNo === 146)).toBe(false);
  });

  it("returns the input unchanged when selectedChapter is null (global review)", () => {
    expect(filterFlashcardsByChapter(cards, null)).toEqual(cards);
    expect(filterFlashcardsByChapter(cards, undefined)).toEqual(cards);
    expect(filterFlashcardsByChapter(cards, "")).toEqual(cards);
  });

  it("returns an empty array when no cards match the selected chapter (no global fallback)", () => {
    expect(filterFlashcardsByChapter(cards, "999")).toEqual([]);
  });

  it("treats unrecognized selectors as global rather than empty", () => {
    // "all" / "ALL" don't carry a chapter number — interpret as no scope.
    // This mirrors the page-level behavior where a missing or malformed
    // ?chapter= param falls back to global review.
    expect(filterFlashcardsByChapter(cards, "all")).toEqual(cards);
  });

  it("scopes correctly when local-first cards use snake_case", () => {
    const localCards = [
      { id: "x", chapter_no: 149 },
      { id: "y", chapter_no: 150 },
    ];
    const result = filterFlashcardsByChapter(localCards, "149");
    expect(result.map((c) => c.id)).toEqual(["x"]);
  });
});

describe("buildReviewQueue contract — Apr 30 2026 regression", () => {
  // Reproduces the bug report verbatim: /flashcards/review?chapter=149
  // was rendering a # فصل 150 card. The visible queue must be chapter-pure.
  type Card = { id: string; chapterNo: number | null };

  function buildReviewQueue(input: { chapter: unknown; cards: Card[] }) {
    return filterFlashcardsByChapter(input.cards, input.chapter);
  }

  const cardA: Card = { id: "fc_149", chapterNo: 149 };
  const cardB: Card = { id: "fc_150", chapterNo: 150 };
  const cardC: Card = { id: "fc_146", chapterNo: 146 };
  const leakyGlobalQueue = [cardA, cardB, cardC];

  it("buildReviewQueue({ chapter: '149' }) returns only chapter 149 cards", () => {
    const queue = buildReviewQueue({ chapter: "149", cards: leakyGlobalQueue });
    expect(queue).toHaveLength(1);
    expect(queue[0]!.id).toBe("fc_149");
    expect(queue[0]!.chapterNo).toBe(149);
  });

  it("counts shown for chapter 149 are based only on chapter 149 cards", () => {
    const queue = buildReviewQueue({ chapter: 149, cards: leakyGlobalQueue });
    // Progress numerator/denominator and dueCount badge all derive from queue.length.
    expect(queue.length).toBe(1);
    // The visible card index 0 is a chapter-149 card.
    expect(queue[0]!.chapterNo).toBe(149);
  });

  it("hard acceptance: no chapter 150 or 146 card is rendered when ?chapter=149", () => {
    const queue = buildReviewQueue({ chapter: "149", cards: leakyGlobalQueue });
    expect(queue.find((c) => c.chapterNo === 150)).toBeUndefined();
    expect(queue.find((c) => c.chapterNo === 146)).toBeUndefined();
  });

  it("empty/unknown chapter does NOT fall back to global queue", () => {
    const queue = buildReviewQueue({ chapter: "999", cards: leakyGlobalQueue });
    expect(queue).toHaveLength(0);
  });

  it("normal global review without chapter param still works as before", () => {
    const queue = buildReviewQueue({ chapter: null, cards: leakyGlobalQueue });
    expect(queue).toHaveLength(3);
  });

  it("accepts every documented chapter selector format for chapter 149 with identical results", () => {
    for (const selector of ["149", 149, "Chapter 149", "فصل 149", "# فصل 149", "۱۴۹"]) {
      const queue = buildReviewQueue({ chapter: selector, cards: leakyGlobalQueue });
      expect(queue.map((c) => c.id)).toEqual(["fc_149"]);
    }
  });
});
