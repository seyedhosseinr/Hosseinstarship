"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterStatus } from "@/lib/library/progress";

const STATUS_RANK: Record<ChapterStatus, number> = {
  not_started: 0,
  reading: 1,
  read: 2,
  reviewed: 3,
  mastered: 4,
};

function upgrade(current: ChapterStatus, next: ChapterStatus): ChapterStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

function postProgress(chapterNo: number, event: string, statusValue?: string) {
  return fetch("/api/library/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chapterNo,
      event,
      ...(statusValue !== undefined ? { status: statusValue } : {}),
    }),
  });
}

const STATUS_LABELS: Record<ChapterStatus, string> = {
  not_started: "Not started",
  reading: "Reading",
  read: "Read",
  reviewed: "Reviewed",
  mastered: "Mastered",
};

export function useStatusMachine(chapterNo: number, initialStatus: ChapterStatus) {
  const [status, setStatus] = useState<ChapterStatus>(initialStatus);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-upgrade to "reading" after 1s
  useEffect(() => {
    openTimer.current = setTimeout(() => {
      void postProgress(chapterNo, "opened");
      setStatus((s) => upgrade(s, "reading"));
    }, 1000);

    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    };
  }, [chapterNo]);

  const markRead = useCallback(() => {
    void postProgress(chapterNo, "read");
    setStatus((s) => upgrade(s, "read"));
  }, [chapterNo]);

  const setManual = useCallback(
    (next: ChapterStatus) => {
      setStatus((current) => {
        const upgraded = upgrade(current, next);
        if (upgraded !== current) {
          void postProgress(chapterNo, "set_status", upgraded);
        }
        return upgraded;
      });
    },
    [chapterNo],
  );

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    markRead,
    setManual,
    /** Expose for external checks */
    statusRank: STATUS_RANK[status],
  };
}
