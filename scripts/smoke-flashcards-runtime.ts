import {
  createManagedFlashcard,
  getManagedFlashcardStats,
  listManagedDueFlashcards,
  listManagedFlashcards,
  reviewManagedFlashcard,
  undoLastManagedReview,
} from "@/lib/services/flashcard-service";

async function main() {
  const created = await createManagedFlashcard({
    front: "Supported flashcard smoke front",
    back: "Supported flashcard smoke back",
    type: "basic",
    sourceType: "manual",
    deck: "smoke",
    status: "active",
    tags: ["smoke"],
  });

  const [list, dueBefore, statsBefore] = await Promise.all([
    listManagedFlashcards({ limit: 10 }),
    listManagedDueFlashcards(10),
    getManagedFlashcardStats(),
  ]);

  if (!list.some((card) => card.id === created.record.id)) {
    throw new Error("Created flashcard did not appear in the listing.");
  }

  if (!dueBefore.some((card) => card.id === created.record.id)) {
    throw new Error("Created flashcard did not appear in the due queue.");
  }

  const reviewResult = await reviewManagedFlashcard({
    flashcardId: created.record.id,
    rating: 3,
    sessionId: "smoke-session",
    timeSpentMs: 1200,
    examDate: null,
  });

  const undoResult = await undoLastManagedReview(created.record.id);
  const statsAfter = await getManagedFlashcardStats();

  if (!undoResult) {
    throw new Error("Undo flashcard review did not return a result.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        createdId: created.record.id,
        listedCount: list.length,
        dueBefore: dueBefore.length,
        reviewedState: reviewResult.state,
        remainingDueAfterReview: reviewResult.remainingDue,
        remainingDueAfterUndo: undoResult.remainingDue,
        statsBefore,
        statsAfter,
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
