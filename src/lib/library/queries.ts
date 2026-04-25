import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { chapterProgress, chapters, flashcards, noteDocuments, noteFrames, questionAttempts, questions } from "@/db/schema";
import { getCampbellChapter, includedCampbellChapters } from "./campbell";
import type { ChapterStatus } from "./progress";
import { getNoteByDocId } from "@/lib/contract/queries";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";

export type ChapterProgressRow = typeof chapterProgress.$inferSelect;

export type CampbellChapterLeaf = {
  chapterNo: number;
  title: string;
  href: string | null;
  isLinked: boolean;
  isActive: boolean;
  status: ChapterStatus;
};

export type CampbellPartGroup = {
  key: string;
  volume: number;
  part: string;
  readCount: number;
  totalCount: number;
  chapters: CampbellChapterLeaf[];
};

export type CampbellVolumeGroup = {
  volume: number;
  parts: CampbellPartGroup[];
};

export type LibraryDashboardData = {
  totalIncluded: number;
  totalRead: number;
  totalMastered: number;
  parts: Array<{
    key: string;
    volume: number;
    part: string;
    chapterCount: number;
    readCount: number;
    masteredCount: number;
    accuracyPercent: number | null;
  }>;
  recentlyRead: Array<{
    chapterNo: number;
    title: string;
    lastReadAt: number;
    href: string | null;
  }>;
  weakChapters: Array<{
    chapterNo: number;
    title: string;
    attempted: number;
    correct: number;
    accuracyPercent: number;
    href: string | null;
  }>;
};

export type CampbellVolumeSummary = {
  volumeNo: number;
  title: string;
  chapterCount: number;
  availableChapterCount: number;
  segmentCount: number;
  readCount: number;
  masteredCount: number;
  href: string;
};

export type CampbellVolumeDetail = {
  volumeNo: number;
  title: string;
  chapterCount: number;
  availableChapterCount: number;
  segmentCount: number;
  chapters: Array<{
    chapterNo: number;
    title: string;
    part: string;
    status: ChapterStatus;
    segmentCount: number;
    hasContent: boolean;
    href: string;
  }>;
};

export type CampbellChapterDetail = {
  chapterNo: number;
  title: string;
  volumeNo: number;
  part: string;
  pageRange: string | null;
  status: ChapterStatus;
  segmentCount: number;
  questionCount: number;
  flashcardCount: number;
  segments: Array<{
    docId: string;
    chunkIndex: number;
    pageRange: string | null;
    frameCount: number;
    generatedAt: string;
    href: string;
  }>;
  previousChapterNo: number | null;
  nextChapterNo: number | null;
};

export type ChapterReaderContext = {
  chapterHref: string;
  chapterTitle: string;
  segmentIndex: number;
  segmentCount: number;
  previousSegmentHref: string | null;
  nextSegmentHref: string | null;
};

type NoteRepresentative = {
  docId: string;
  chapterNo: number;
};

type ChapterSegmentRow = {
  chapterNo: number;
  docId: string;
  chunkIndex: number;
  pageRange: string | null;
  generatedAt: number;
  frameCount: number;
};

type QuestionAccuracyRow = {
  chapterNo: number;
  attempted: number;
  correct: number;
};

type ChapterIdRow = {
  id: string;
};

function statusOrDefault(status: string | null | undefined): ChapterStatus {
  switch (status) {
    case "reading":
    case "read":
    case "reviewed":
    case "mastered":
      return status;
    default:
      return "not_started";
  }
}

function isReadStatus(status: ChapterStatus) {
  return status === "read" || status === "reviewed" || status === "mastered";
}

const chooseRepresentativeDocs = cache(async function chooseRepresentativeDocs(): Promise<Map<number, NoteRepresentative>> {
  const db = await getDb();
  const docs = await db
    .select({
      docId: noteDocuments.docId,
      chapterNo: noteDocuments.chapterNo,
    })
    .from(noteDocuments)
    .where(eq(noteDocuments.ingestStatus, "active"))
    .orderBy(
      asc(noteDocuments.chapterNo),
      asc(noteDocuments.chunkIndex),
      desc(noteDocuments.version),
      desc(noteDocuments.generatedAt),
    );

  const byChapter = new Map<number, NoteRepresentative>();
  for (const doc of docs) {
    if (!byChapter.has(doc.chapterNo)) {
      byChapter.set(doc.chapterNo, {
        docId: doc.docId,
        chapterNo: doc.chapterNo,
      });
    }
  }

  return byChapter;
});

const getChapterSegmentRows = cache(async function getChapterSegmentRows(): Promise<ChapterSegmentRow[]> {
  const db = await getDb();
  const [docs, frames] = await Promise.all([
    db
      .select({
        chapterNo: noteDocuments.chapterNo,
        docId: noteDocuments.docId,
        chunkIndex: noteDocuments.chunkIndex,
        pageRange: noteDocuments.pageRange,
        generatedAt: noteDocuments.generatedAt,
      })
      .from(noteDocuments)
      .where(eq(noteDocuments.ingestStatus, "active"))
      .orderBy(
        asc(noteDocuments.chapterNo),
        asc(noteDocuments.chunkIndex),
        desc(noteDocuments.version),
        desc(noteDocuments.generatedAt),
      ),
    db
      .select({
        docId: noteFrames.docId,
        count: sql<number>`COUNT(${noteFrames.id})`,
      })
      .from(noteFrames)
      .groupBy(noteFrames.docId),
  ]);

  const frameCountByDocId = new Map<string, number>(frames.map((row) => [row.docId, row.count]));

  return docs.map((doc) => ({
    chapterNo: doc.chapterNo,
    docId: doc.docId,
    chunkIndex: doc.chunkIndex,
    pageRange: doc.pageRange,
    generatedAt: doc.generatedAt,
    frameCount: frameCountByDocId.get(doc.docId) ?? 0,
  }));
});

export const getChapterProgressMap = cache(async function getChapterProgressMap(): Promise<Map<number, ChapterProgressRow>> {
  const db = await getDb();
  const rows = await db.select().from(chapterProgress);

  return new Map(rows.map((row) => [row.chapterNo, row as ChapterProgressRow]));
});

export const getCampbellNavigation = cache(async function getCampbellNavigation(activeChapterNo?: number): Promise<CampbellVolumeGroup[]> {
  const [docByChapter, progressByChapter] = await Promise.all([
    chooseRepresentativeDocs(),
    getChapterProgressMap(),
  ]);
  const volumeMap = new Map<number, Map<string, CampbellPartGroup>>();

  for (const chapter of includedCampbellChapters) {
    const volumeGroups = volumeMap.get(chapter.volume) ?? new Map<string, CampbellPartGroup>();
    const partKey = `${chapter.volume}:${chapter.part}`;
    const progress = progressByChapter.get(chapter.chapter);
    const status = statusOrDefault(progress?.status);
    const linkedDoc = docByChapter.get(chapter.chapter);

    const partGroup = volumeGroups.get(partKey) ?? {
      key: partKey,
      volume: chapter.volume,
      part: chapter.part,
      readCount: 0,
      totalCount: 0,
      chapters: [],
    };

    partGroup.totalCount += 1;
    if (isReadStatus(status)) {
      partGroup.readCount += 1;
    }

    partGroup.chapters.push({
      chapterNo: chapter.chapter,
      title: chapter.title,
      href: linkedDoc ? `/notes/${linkedDoc.docId}` : null,
      isLinked: Boolean(linkedDoc),
      isActive: activeChapterNo === chapter.chapter,
      status,
    });

    volumeGroups.set(partKey, partGroup);
    volumeMap.set(chapter.volume, volumeGroups);
  }

  return Array.from(volumeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([volume, parts]) => ({
      volume,
      parts: Array.from(parts.values()).sort((a, b) => a.chapters[0].chapterNo - b.chapters[0].chapterNo),
    }));
});

const getQuestionAccuracyByChapter = cache(async function getQuestionAccuracyByChapter(): Promise<Map<number, QuestionAccuracyRow>> {
  const db = await getDb();
  const rows = await db
    .select({
      chapterNo: chapters.chapterNo,
      attempted: sql<number>`COUNT(${questionAttempts.id})`,
      correct: sql<number>`SUM(CASE WHEN ${questionAttempts.outcome} = 'correct' THEN 1 ELSE 0 END)`,
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .groupBy(chapters.chapterNo);

  return new Map(rows.map((row) => [row.chapterNo, row]));
});

export const getLibraryDashboardData = cache(async function getLibraryDashboardData(): Promise<LibraryDashboardData> {
  const [progressByChapter, docByChapter, accuracyByChapter, navigation] = await Promise.all([
    getChapterProgressMap(),
    chooseRepresentativeDocs(),
    getQuestionAccuracyByChapter(),
    getCampbellNavigation(),
  ]);

  const parts = navigation.flatMap((volume) =>
    volume.parts.map((part) => {
      const chapterNos = part.chapters.map((chapter) => chapter.chapterNo);
      const accuracyRows = chapterNos
        .map((chapterNo) => accuracyByChapter.get(chapterNo))
        .filter((row): row is QuestionAccuracyRow => Boolean(row));
      const attempted = accuracyRows.reduce((sum, row) => sum + row.attempted, 0);
      const correct = accuracyRows.reduce((sum, row) => sum + row.correct, 0);

      return {
        key: part.key,
        volume: part.volume,
        part: part.part,
        chapterCount: part.totalCount,
        readCount: part.readCount,
        masteredCount: part.chapters.filter((chapter) => chapter.status === "mastered").length,
        accuracyPercent: attempted > 0 ? Math.round((correct / attempted) * 100) : null,
      };
    }),
  );

  const progressRows = Array.from(progressByChapter.values());
  const recentlyRead = progressRows
    .filter((row) => row.lastReadAt !== null)
    .sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0))
    .slice(0, 5)
    .map((row) => {
      const chapter = getCampbellChapter(row.chapterNo);
      const linkedDoc = docByChapter.get(row.chapterNo);

      return {
        chapterNo: row.chapterNo,
        title: chapter?.title ?? `Chapter ${row.chapterNo}`,
        lastReadAt: row.lastReadAt ?? 0,
        href: linkedDoc ? `/notes/${linkedDoc.docId}` : null,
      };
    });

  const weakChapters = Array.from(accuracyByChapter.entries())
    .map(([chapterNo, stats]) => {
      const chapter = getCampbellChapter(chapterNo);
      const linkedDoc = docByChapter.get(chapterNo);

      return {
        chapterNo,
        title: chapter?.title ?? `Chapter ${chapterNo}`,
        attempted: stats.attempted,
        correct: stats.correct,
        accuracyPercent: stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0,
        href: linkedDoc ? `/notes/${linkedDoc.docId}` : null,
      };
    })
    .filter((row) => row.attempted > 0 && row.accuracyPercent < 60)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent)
    .slice(0, 5);

  const totalRead = includedCampbellChapters.filter((chapter) =>
    isReadStatus(statusOrDefault(progressByChapter.get(chapter.chapter)?.status)),
  ).length;
  const totalMastered = includedCampbellChapters.filter(
    (chapter) => statusOrDefault(progressByChapter.get(chapter.chapter)?.status) === "mastered",
  ).length;

  return {
    totalIncluded: includedCampbellChapters.length,
    totalRead,
    totalMastered,
    parts: parts.sort((a, b) => {
      const aRate = a.chapterCount > 0 ? a.readCount / a.chapterCount : 0;
      const bRate = b.chapterCount > 0 ? b.readCount / b.chapterCount : 0;
      return aRate - bRate || a.volume - b.volume || a.part.localeCompare(b.part);
    }),
    recentlyRead,
    weakChapters,
  };
});

export const getCampbellVolumeSummaries = cache(async function getCampbellVolumeSummaries(): Promise<CampbellVolumeSummary[]> {
  const [progressByChapter, segmentRows] = await Promise.all([
    getChapterProgressMap(),
    getChapterSegmentRows(),
  ]);
  const segmentCountByChapter = new Map<number, number>();

  for (const row of segmentRows) {
    segmentCountByChapter.set(row.chapterNo, (segmentCountByChapter.get(row.chapterNo) ?? 0) + 1);
  }

  const summaries = new Map<number, CampbellVolumeSummary>();

  for (const chapter of includedCampbellChapters) {
    const summary = summaries.get(chapter.volume) ?? {
      volumeNo: chapter.volume,
      title: `Volume ${chapter.volume}`,
      chapterCount: 0,
      availableChapterCount: 0,
      segmentCount: 0,
      readCount: 0,
      masteredCount: 0,
      href: `/library/campbell/volume/${chapter.volume}`,
    };

    const status = statusOrDefault(progressByChapter.get(chapter.chapter)?.status);
    const segmentCount = segmentCountByChapter.get(chapter.chapter) ?? 0;

    summary.chapterCount += 1;
    summary.segmentCount += segmentCount;
    if (segmentCount > 0) summary.availableChapterCount += 1;
    if (isReadStatus(status)) summary.readCount += 1;
    if (status === "mastered") summary.masteredCount += 1;

    summaries.set(chapter.volume, summary);
  }

  return Array.from(summaries.values()).sort((a, b) => a.volumeNo - b.volumeNo);
});

export const getCampbellVolumeDetail = cache(async function getCampbellVolumeDetail(volumeNo: number): Promise<CampbellVolumeDetail | null> {
  const chaptersInVolume = includedCampbellChapters.filter((chapter) => chapter.volume === volumeNo);

  if (chaptersInVolume.length === 0) {
    return null;
  }

  const [progressByChapter, segmentRows] = await Promise.all([
    getChapterProgressMap(),
    getChapterSegmentRows(),
  ]);
  const segmentCountByChapter = new Map<number, number>();

  for (const row of segmentRows) {
    segmentCountByChapter.set(row.chapterNo, (segmentCountByChapter.get(row.chapterNo) ?? 0) + 1);
  }

  const volumeChapters = chaptersInVolume.map((chapter) => {
    const status = statusOrDefault(progressByChapter.get(chapter.chapter)?.status);
    const segmentCount = segmentCountByChapter.get(chapter.chapter) ?? 0;

    return {
      chapterNo: chapter.chapter,
      title: chapter.title,
      part: chapter.part,
      status,
      segmentCount,
      hasContent: segmentCount > 0,
      href: `/library/campbell/chapter/${chapter.chapter}`,
    };
  });

  return {
    volumeNo,
    title: `Volume ${volumeNo}`,
    chapterCount: volumeChapters.length,
    availableChapterCount: volumeChapters.filter((chapter) => chapter.hasContent).length,
    segmentCount: volumeChapters.reduce((sum, chapter) => sum + chapter.segmentCount, 0),
    chapters: volumeChapters,
  };
});

async function getChapterIdByChapterNo(chapterNo: number): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(eq(chapters.chapterNo, chapterNo))
    .limit(1);

  return rows[0]?.id ?? null;
}

export const getCampbellChapterDetail = cache(async function getCampbellChapterDetail(chapterNo: number): Promise<CampbellChapterDetail | null> {
  const chapter = getCampbellChapter(chapterNo);

  if (!chapter) {
    return null;
  }

  const [progressByChapter, allSegmentRows, chapterId] = await Promise.all([
    getChapterProgressMap(),
    getChapterSegmentRows(),
    getChapterIdByChapterNo(chapterNo),
  ]);
  const status = statusOrDefault(progressByChapter.get(chapterNo)?.status);

  const db = await getDb();
  const docs = await db
    .select()
    .from(noteDocuments)
    .where(eq(noteDocuments.chapterNo, chapterNo))
    .orderBy(
      asc(noteDocuments.chunkIndex),
      desc(noteDocuments.version),
      desc(noteDocuments.generatedAt),
    );

  const uniqueDocs = new Map<string, (typeof docs)[number]>();
  for (const doc of docs) {
    if (doc.ingestStatus !== "active") continue;
    if (!uniqueDocs.has(doc.docId)) {
      uniqueDocs.set(doc.docId, doc);
    }
  }

  const segmentRowsByDocId = new Map<string, ChapterSegmentRow>(
    allSegmentRows
      .filter((row) => row.chapterNo === chapterNo)
      .map((row) => [row.docId, row]),
  );

  const questionCount = chapterId
    ? (
        await db
          .select({ count: sql<number>`COUNT(${questions.id})` })
          .from(questions)
          .where(eq(questions.chapterId, chapterId))
          .limit(1)
      )[0]?.count ?? 0
    : 0;

  const flashcardCount = chapterId
    ? (
        await db
          .select({ count: sql<number>`COUNT(${flashcards.id})` })
          .from(flashcards)
          .where(eq(flashcards.chapterId, chapterId))
          .limit(1)
      )[0]?.count ?? 0
    : 0;

  const segments = Array.from(uniqueDocs.values())
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((doc) => ({
      docId: doc.docId,
      chunkIndex: doc.chunkIndex,
      pageRange: doc.pageRange,
      frameCount: segmentRowsByDocId.get(doc.docId)?.frameCount ?? 0,
      generatedAt: new Date(doc.generatedAt).toISOString(),
      href: `/notes/${doc.docId}`,
    }));

  const chapterIndex = includedCampbellChapters.findIndex((item) => item.chapter === chapterNo);

  return {
    chapterNo,
    title: chapter.title,
    volumeNo: chapter.volume,
    part: chapter.part,
    pageRange:
      chapter.start_page && chapter.end_page
        ? `${chapter.start_page}-${chapter.end_page}`
        : null,
    status,
    segmentCount: segments.length,
    questionCount,
    flashcardCount,
    segments,
    previousChapterNo: chapterIndex > 0 ? includedCampbellChapters[chapterIndex - 1]?.chapter ?? null : null,
    nextChapterNo:
      chapterIndex >= 0 && chapterIndex < includedCampbellChapters.length - 1
        ? includedCampbellChapters[chapterIndex + 1]?.chapter ?? null
        : null,
  };
});

export const getChapterReaderContextForDoc = cache(async function getChapterReaderContextForDoc(docId: string): Promise<ChapterReaderContext | null> {
  const db = await getDb();
  const currentDocs = await db
    .select({
      docId: noteDocuments.docId,
      chapterNo: noteDocuments.chapterNo,
    })
    .from(noteDocuments)
    .where(eq(noteDocuments.docId, docId))
    .limit(1);
  const currentDoc = currentDocs[0];

  if (!currentDoc) {
    return null;
  }

  const chapter = await getCampbellChapterDetail(currentDoc.chapterNo);

  if (!chapter) {
    return null;
  }

  const segmentIndex = chapter.segments.findIndex((segment) => segment.docId === docId);

  if (segmentIndex < 0) {
    return null;
  }

  return {
    chapterHref: `/library/campbell/chapter/${chapter.chapterNo}`,
    chapterTitle: chapter.title,
    segmentIndex: segmentIndex + 1,
    segmentCount: chapter.segments.length,
    previousSegmentHref: segmentIndex > 0 ? chapter.segments[segmentIndex - 1]?.href ?? null : null,
    nextSegmentHref:
      segmentIndex < chapter.segments.length - 1 ? chapter.segments[segmentIndex + 1]?.href ?? null : null,
  };
});

export async function getQuestionChapterNo(questionId: string) {
  const db = await getDb();
  const rows = await db
    .select({ chapterNo: chapters.chapterNo })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .where(eq(questions.id, questionId))
    .limit(1);

  return rows[0]?.chapterNo ?? null;
}

/* ─────────────────────────────────────────────────────────────────────────
   CHAPTER READER BUNDLE
   Fetches everything needed to render the full chapter reader in one call.
───────────────────────────────────────────────────────────────────────── */

export type ChapterReaderBundle = {
  chapter: CampbellChapterDetail;
  /** All imported note segments for this chapter, ordered by chunkIndex */
  notes: NoteViewerModel[];
};

export const getChapterReaderBundle = cache(async function getChapterReaderBundle(
  chapterNo: number,
): Promise<ChapterReaderBundle | null> {
  const chapter = await getCampbellChapterDetail(chapterNo);
  if (!chapter) return null;

  const noteResults = await Promise.all(
    chapter.segments.map((seg) => getNoteByDocId(seg.docId)),
  );

  const notes = noteResults
    .filter((n): n is NoteViewerModel => n !== null)
    .sort((a, b) => a.meta.chunkIndex - b.meta.chunkIndex);

  return { chapter, notes };
});
