/**
 * Regression test for the chapter-scoped flashcard review queue.
 *
 * Bug: /flashcards/review?chapter=149 was rendering cards from other
 * chapters (150, 146, …) because the page never read the URL param.
 * These tests assert the screen never renders a non-149 card when
 * scoped to chapter 149, regardless of what `initialCards` contains.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlashcardReviewScreen } from "../FlashcardReviewScreen";

type ReviewCard = React.ComponentProps<typeof FlashcardReviewScreen>["initialCards"][number];

function buildCard(overrides: Partial<ReviewCard>): ReviewCard {
  return {
    id: "fc_test",
    frontHtml: "front",
    backHtml: "back",
    cardType: "basic",
    chapterNo: null,
    chapterTitle: null,
    sourceQuestionId: null,
    sourceDocId: null,
    sourceFrameId: null,
    tags: [],
    deck: null,
    dueAt: Date.now(),
    state: "new",
    intervalDays: 0,
    isLeech: false,
    isSuspended: false,
    predictions: {
      again: { interval: "10m", days: 0 },
      hard:  { interval: "1d",  days: 1 },
      good:  { interval: "3d",  days: 3 },
      easy:  { interval: "7d",  days: 7 },
    },
    ...overrides,
  };
}

describe("FlashcardReviewScreen — chapter scope", () => {
  // Mixed fixture that mirrors the production bug:
  // chapter 149 (target), 150 and 146 (must not leak).
  const mixedCards: ReviewCard[] = [
    buildCard({
      id: "card-150",
      chapterNo: 150,
      frontHtml: "<p>QUESTION_FROM_CHAPTER_150</p>",
      backHtml: "<p>ANSWER_FROM_CHAPTER_150</p>",
    }),
    buildCard({
      id: "card-149",
      chapterNo: 149,
      frontHtml: "<p>QUESTION_FROM_CHAPTER_149</p>",
      backHtml: "<p>ANSWER_FROM_CHAPTER_149</p>",
    }),
    buildCard({
      id: "card-146",
      chapterNo: 146,
      frontHtml: "<p>QUESTION_FROM_CHAPTER_146</p>",
      backHtml: "<p>ANSWER_FROM_CHAPTER_146</p>",
    }),
  ];

  it("does NOT render chapter 150 or 146 cards when scoped to chapter 149", () => {
    const html = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter="149" />,
    );
    expect(html).not.toContain("QUESTION_FROM_CHAPTER_150");
    expect(html).not.toContain("QUESTION_FROM_CHAPTER_146");
    // The chapter 149 card MUST be the visible one.
    expect(html).toContain("QUESTION_FROM_CHAPTER_149");
  });

  it("renders the chapter chip showing فصل 149 when scoped to chapter 149", () => {
    const html = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter="149" />,
    );
    // The first rendered card must belong to chapter 149.
    // The chip is `# فصل {chapterNo}`.
    expect(html).toMatch(/فصل\s*149/);
    expect(html).not.toMatch(/فصل\s*150/);
  });

  it("counts shown for chapter 149 are based only on chapter 149 cards", () => {
    const html = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter="149" />,
    );
    // The progress chip is `<index+1> / <total>` — total must equal the
    // count of chapter-149 cards in the input (1 here), NOT 3.
    expect(html).toMatch(/1\s*\/\s*1/);
    expect(html).not.toMatch(/1\s*\/\s*3/);
  });

  it("shows the chapter-scoped empty state when no cards match", () => {
    const html = renderToStaticMarkup(
      <FlashcardReviewScreen
        initialCards={[
          buildCard({ id: "x", chapterNo: 150, frontHtml: "<p>OTHER</p>" }),
        ]}
        chapter="149"
      />,
    );
    // Empty-state heading mentions the selected chapter rather than the
    // generic "all done" message.
    expect(html).toContain("فصل 149");
    expect(html).not.toContain("OTHER");
  });

  it("shows global review when no chapter is provided", () => {
    const html = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter={null} />,
    );
    // No filtering — first card (chapter 150) is the visible one.
    expect(html).toContain("QUESTION_FROM_CHAPTER_150");
    expect(html).toMatch(/1\s*\/\s*3/);
  });

  it("normalizes Persian-prefixed chapter selectors equivalently to '149'", () => {
    const htmlNumeric = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter="149" />,
    );
    const htmlPersian = renderToStaticMarkup(
      <FlashcardReviewScreen initialCards={mixedCards} chapter="فصل 149" />,
    );
    // Same visible card in both representations.
    expect(htmlPersian).toContain("QUESTION_FROM_CHAPTER_149");
    expect(htmlPersian).not.toContain("QUESTION_FROM_CHAPTER_150");
    // Identical scope means identical visible queue size.
    const sizeNumeric = (htmlNumeric.match(/QUESTION_FROM_CHAPTER_/g) ?? []).length;
    const sizePersian = (htmlPersian.match(/QUESTION_FROM_CHAPTER_/g) ?? []).length;
    expect(sizePersian).toBe(sizeNumeric);
  });
});
