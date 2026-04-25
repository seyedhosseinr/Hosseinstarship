import { createEmptyCard, State, type Card } from "ts-fsrs";
import type { flashcards } from "@/db/schema";

type DBFlashcard = typeof flashcards.$inferSelect;

export function stateFromString(value: string | null | undefined): State {
  switch (value) {
    case "learning":
      return State.Learning;
    case "review":
      return State.Review;
    case "relearning":
      return State.Relearning;
    default:
      return State.New;
  }
}

export function stateToString(value: State): "new" | "learning" | "review" | "relearning" {
  switch (value) {
    case State.Learning:
      return "learning";
    case State.Review:
      return "review";
    case State.Relearning:
      return "relearning";
    default:
      return "new";
  }
}

export function dbToFSRSCard(dbCard: DBFlashcard): Card {
  if (!dbCard.fsrsDue || !dbCard.fsrsState || dbCard.fsrsState === "new") {
    return createEmptyCard();
  }

  return {
    due: new Date(dbCard.fsrsDue),
    stability: dbCard.fsrsStability || 0,
    difficulty: dbCard.fsrsDifficulty || 0,
    elapsed_days: dbCard.fsrsElapsedDays || 0,
    scheduled_days: dbCard.fsrsScheduledDays || 0,
    learning_steps: dbCard.learningStep || 0,
    reps: dbCard.fsrsReps || 0,
    lapses: dbCard.fsrsLapses || 0,
    state: stateFromString(dbCard.fsrsState),
    last_review: dbCard.fsrsLastReview ? new Date(dbCard.fsrsLastReview) : undefined,
  };
}

export function fsrsCardToDBFields(card: Card): Partial<DBFlashcard> {
  return {
    fsrsDue: card.due.getTime(),
    fsrsStability: card.stability,
    fsrsDifficulty: card.difficulty,
    fsrsElapsedDays: card.elapsed_days,
    fsrsScheduledDays: card.scheduled_days,
    fsrsReps: card.reps,
    fsrsLapses: card.lapses,
    fsrsState: stateToString(card.state),
    fsrsLastReview: card.last_review?.getTime() ?? null,
    learningStep: card.learning_steps,
    intervalDays: Math.round(card.scheduled_days),
  };
}
