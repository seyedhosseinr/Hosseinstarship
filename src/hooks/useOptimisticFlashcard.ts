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

export function useOptimisticFlashcard(initialDueCount: number) {
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
    const response = await fetch("/api/flashcards/review?limit=1", { cache: "no-store" });
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

      let remainingDue =
        typeof payload.remainingDue === "number" && Number.isFinite(payload.remainingDue)
          ? Math.max(0, Math.trunc(payload.remainingDue))
          : Math.max(0, previousDueCount - 1);

      if (typeof payload.remainingDue !== "number") {
        try {
          remainingDue = await syncDueCountFromServer();
        } catch {
          // Keep optimistic fallback when sync endpoint is temporarily unavailable.
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
