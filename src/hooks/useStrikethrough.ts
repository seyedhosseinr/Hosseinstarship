"use client";

import { useState, useCallback } from "react";

/**
 * Manages per-question option strikethrough state.
 * Returns a record of questionId → Set of struck option IDs.
 */
export function useStrikethrough() {
  const [strikeMap, setStrikeMap] = useState<Record<string, Set<string>>>({});

  const toggle = useCallback((questionId: string, optionId: string) => {
    setStrikeMap((prev) => {
      const s = new Set(prev[questionId] ?? []);
      if (s.has(optionId)) s.delete(optionId);
      else s.add(optionId);
      return { ...prev, [questionId]: s };
    });
  }, []);

  const getStrikes = useCallback(
    (questionId: string): Set<string> => strikeMap[questionId] ?? new Set(),
    [strikeMap],
  );

  return { toggle, getStrikes };
}
