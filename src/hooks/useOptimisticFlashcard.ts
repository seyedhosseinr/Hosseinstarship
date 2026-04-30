"use client";

import { useOptimistic, useTransition } from "react";
import { useCallback } from "react";
import { errorToasts, successToasts } from "@/lib/toast/notifications";

interface FlashcardOptimisticState {
  currentCardId: string | null;
  dueCount: number;
  isReviewing: boolean;
  lastRating: 1 | 2 | 3 | 4 | null;
}

interface ReviewResultShape {
  ok?: boolean;
  remainingDue?: number;
  result?: {
    dueAt?: number | null;
    state?: string;
  };
}

export function useOptimisticFlashcard(initialDueCount: number, chapter: string | null = null) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useOptimistic<FlashcardOptimisticState, Partial<FlashcardOptimisticState>>(
    {
      currentCardId: null,
      dueCount: initialDueCount,
      isReviewing: false,
      lastRating: null,
    },
    (current, update) => ({ ...current, ...update }),
  );

  async function syncDueCountFromServer() {
    const url = chapter
      ? `/api/flashcards/review?limit=1&chapter=${encodeURIComponent(chapter)}`
      : "/api/flashcards/review?limit=1";
    const response = await fetch(url, { cache: "no-store" });
    const data = (await response.json()) as { totalDue?: number; cards?: unknown[] };
    if (typeof data.totalDue === "number" && Number.isFinite(data.totalDue)) {
      return Math.max(0, Math.trunc(data.totalDue));
    }
    return Array.isArray(data.cards) ? data.cards.length : 0;
  }

  async function rateCard(cardId: string, rating: 1 | 2 | 3 | 4) {
    const previousDueCount = state.dueCount;

    startTransition(() => {
      setState({
        currentCardId: cardId,
        isReviewing: true,
        lastRating: rating,
        dueCount: Math.max(0, previousDueCount - 1),
      });
    });

    try {
      const response = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcardId: cardId, rating }),
      });

      if (!response.ok) {
        throw new Error("review request failed");
      }

      const payload = (await response.json()) as ReviewResultShape;
      if (!payload.ok) {
        throw new Error("review failed");
      }

      // The POST /api/flashcards/review endpoint returns a GLOBAL
      // remainingDue count. In chapter-scoped review we must ignore that
      // and re-fetch the chapter-scoped count instead, otherwise the
      // "موعد" badge would briefly jump to the global figure.
      let remainingDue: number;
      if (chapter) {
        try {
          remainingDue = await syncDueCountFromServer();
        } catch {
          remainingDue = Math.max(0, previousDueCount - 1);
        }
      } else if (typeof payload.remainingDue === "number" && Number.isFinite(payload.remainingDue)) {
        remainingDue = Math.max(0, Math.trunc(payload.remainingDue));
      } else {
        try {
          remainingDue = await syncDueCountFromServer();
        } catch {
          remainingDue = Math.max(0, previousDueCount - 1);
        }
      }
      startTransition(() => {
        setState({
          dueCount: remainingDue,
          isReviewing: false,
        });
      });
      successToasts.flashcardReviewed(remainingDue);
      return { success: true as const, remainingDue };
    } catch {
      startTransition(() => {
        setState({
          dueCount: previousDueCount,
          isReviewing: false,
        });
      });
      errorToasts.saveFailed();
      return { success: false as const };
    }
  }

  const setDueCountOptimistic = useCallback(
    (next: number) => {
      startTransition(() => {
        setState({ dueCount: Math.max(0, next) });
      });
    },
    [setState],
  );

  return {
    dueCount: state.dueCount,
    isReviewing: state.isReviewing || isPending,
    lastRating: state.lastRating,
    currentCardId: state.currentCardId,
    setDueCountOptimistic,
    rateCard,
  };
}
