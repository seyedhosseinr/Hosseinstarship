import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { chapterProgress } from "@/db/schema";

export const chapterStatuses = [
  "not_started",
  "reading",
  "read",
  "reviewed",
  "mastered",
] as const;

export type ChapterStatus = (typeof chapterStatuses)[number];

type ChapterProgressLike = {
  chapterNo: number;
  status: string;
  readCount: number;
  lastReadAt: number | null;
  qAttempted: number;
  qCorrect: number;
};

const statusRank: Record<ChapterStatus, number> = {
  not_started: 0,
  reading: 1,
  read: 2,
  reviewed: 3,
  mastered: 4,
};

function maxStatus(current: ChapterStatus, next: ChapterStatus): ChapterStatus {
  return statusRank[next] > statusRank[current] ? next : current;
}

async function getChapterProgressRow(chapterNo: number): Promise<ChapterProgressLike | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(chapterProgress)
    .where(eq(chapterProgress.chapterNo, chapterNo))
    .limit(1);

  return rows[0];
}

export async function recordChapterOpen(chapterNo: number) {
  const db = await getDb();
  const now = Date.now();
  const existing = await getChapterProgressRow(chapterNo);

  if (!existing) {
    await db.insert(chapterProgress).values({
      chapterNo,
      status: "reading",
      readCount: 1,
      lastReadAt: now,
      qAttempted: 0,
      qCorrect: 0,
    });
    return;
  }

  const nextStatus = maxStatus(existing.status as ChapterStatus, "reading");
  await db
    .update(chapterProgress)
    .set({
      status: nextStatus,
      readCount: existing.readCount + 1,
      lastReadAt: now,
    })
    .where(eq(chapterProgress.chapterNo, chapterNo));
}

export async function recordChapterRead(chapterNo: number) {
  const db = await getDb();
  const existing = await getChapterProgressRow(chapterNo);

  if (!existing) {
    await db.insert(chapterProgress).values({
      chapterNo,
      status: "read",
      readCount: 1,
      lastReadAt: Date.now(),
      qAttempted: 0,
      qCorrect: 0,
    });
    return;
  }

  const nextStatus = maxStatus(existing.status as ChapterStatus, "read");
  if (nextStatus === existing.status) {
    return;
  }

  await db.update(chapterProgress).set({ status: nextStatus }).where(eq(chapterProgress.chapterNo, chapterNo));
}

export async function setManualChapterStatus(chapterNo: number, status: ChapterStatus) {
  const db = await getDb();
  const existing = await getChapterProgressRow(chapterNo);

  if (!existing) {
    const readCount = statusRank[status] >= statusRank.reading ? 1 : 0;
    const lastReadAt = statusRank[status] >= statusRank.reading ? Date.now() : null;

    await db.insert(chapterProgress).values({
      chapterNo,
      status,
      readCount,
      lastReadAt,
      qAttempted: 0,
      qCorrect: 0,
    });

    return status;
  }

  const nextStatus = maxStatus(existing.status as ChapterStatus, status);
  if (nextStatus === existing.status) {
    return existing.status as ChapterStatus;
  }

  await db.update(chapterProgress).set({ status: nextStatus }).where(eq(chapterProgress.chapterNo, chapterNo));

  return nextStatus;
}

export async function recordChapterQuestionAttempt(chapterNo: number, isCorrect: boolean) {
  const db = await getDb();
  const existing = await getChapterProgressRow(chapterNo);

  if (!existing) {
    await db.insert(chapterProgress).values({
      chapterNo,
      status: "not_started",
      readCount: 0,
      lastReadAt: null,
      qAttempted: 1,
      qCorrect: isCorrect ? 1 : 0,
    });
    return;
  }

  await db
    .update(chapterProgress)
    .set({
      qAttempted: existing.qAttempted + 1,
      qCorrect: existing.qCorrect + (isCorrect ? 1 : 0),
    })
    .where(eq(chapterProgress.chapterNo, chapterNo));
}
