"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the set of question IDs that the user has answered incorrectly
 * for a given chapter. Used by the reader to apply missed-question markers
 * on frames linked to these questions.
 */
export function useMissedQuestionIds(chapterNo: number | null): Set<string> {
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (chapterNo == null) return;

    let cancelled = false;

    fetch(`/api/questions/missed?chapterNo=${chapterNo}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.questionIds)) {
          setMissedIds(new Set(data.questionIds));
        }
      })
      .catch(() => {
        // Silently ignore — the marker layer simply won't show
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNo]);

  return missedIds;
}
