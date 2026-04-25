import { desc, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { examSessions } from "@/db/schema";

export type HistorySessionLite = {
  id: string;
  title: string | null;
  mode: string;
  status: string;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalOmitted: number;
  scorePercent: number | null;
  startedAt: number;
  completedAt: number | null;
  elapsedSeconds: number;
};

export type HistoryLightSnapshot = {
  sessions: HistorySessionLite[];
  counts: {
    total: number;
    completed: number;
    active: number;
    paused: number;
    abandoned: number;
  };
};

export async function getHistoryLightSnapshot(limit = 24): Promise<HistoryLightSnapshot> {
  const db = await getDb();
  const [sessions, countRows] = await Promise.all([
    db
      .select({
        id: examSessions.id,
        title: examSessions.title,
        mode: examSessions.mode,
        status: examSessions.status,
        totalQuestions: examSessions.totalQuestions,
        totalCorrect: examSessions.totalCorrect,
        totalIncorrect: examSessions.totalIncorrect,
        totalOmitted: examSessions.totalOmitted,
        scorePercent: examSessions.scorePercent,
        startedAt: examSessions.startedAt,
        completedAt: examSessions.completedAt,
        elapsedSeconds: examSessions.elapsedSeconds,
      })
      .from(examSessions)
      .orderBy(desc(examSessions.startedAt))
      .limit(limit),
    db
      .select({
        status: examSessions.status,
        count: sql<number>`count(*)`,
      })
      .from(examSessions)
      .groupBy(examSessions.status),
  ]);

  const countByStatus = new Map<string, number>(countRows.map((row) => [row.status, Number(row.count ?? 0)]));

  return {
    sessions,
    counts: {
      total: sessions.length,
      completed: countByStatus.get("completed") ?? 0,
      active: countByStatus.get("active") ?? 0,
      paused: countByStatus.get("suspended") ?? countByStatus.get("paused") ?? 0,
      abandoned: countByStatus.get("abandoned") ?? 0,
    },
  };
}
