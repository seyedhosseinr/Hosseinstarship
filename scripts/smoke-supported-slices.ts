import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { chapters, contractChapters, noteDocuments, noteFrames, noteSections } from "@/db/schema";
import { getAppShellContext } from "@/lib/app-shell/queries";
import { getNoteByDocId, listNoteDocuments } from "@/lib/contract/queries";
import { getHostedDashboardLiteData } from "@/lib/dashboard/lite-queries";
import {
  getCampbellChapterDetail,
  getCampbellVolumeSummaries,
  getChapterReaderContextForDoc,
  getLibraryDashboardData,
} from "@/lib/library/queries";
import { includedCampbellChapters } from "@/lib/library/campbell";
import { listReaderFlashcardsForDoc } from "@/lib/reader/flashcard-queries";
import { getDataSettingsSnapshot } from "@/lib/settings/data-queries";

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureMinimalReaderFixture() {
  const existingDocs = await listNoteDocuments();
  if (existingDocs.length > 0) {
    return existingDocs;
  }

  const db = await getDb();
  const now = Date.now();
  const seedChapter = includedCampbellChapters[0];
  const seedChapterNo = seedChapter?.chapter ?? 1;
  const seedChapterTitle = seedChapter?.title ?? "Supported Smoke Chapter";
  const seedVolumeNo = seedChapter?.volume ?? 1;
  const seedPartTitle = seedChapter?.part ?? "Foundations";
  const existingChapter = await db.query.chapters.findFirst({
    where: eq(chapters.chapterNo, seedChapterNo),
    columns: { id: true },
  });
  const existingContractChapter = await db.query.contractChapters.findFirst({
    where: eq(contractChapters.chapterNo, seedChapterNo),
    columns: { id: true },
  });

  const chapterId = existingChapter?.id ?? makeId("chapter");
  const contractChapterId = existingContractChapter?.id ?? makeId("contract_chapter");
  const docId = makeId("doc");
  const sectionId = makeId("section");
  const frameId = makeId("frame");

  if (!existingChapter) {
    await db.insert(chapters).values({
      id: chapterId,
      volumeNo: seedVolumeNo,
      partNo: 1,
      partTitle: seedPartTitle,
      sectionTitle: "Supported smoke seed",
      chapterNo: seedChapterNo,
      title: seedChapterTitle,
      slug: `supported-smoke-${chapterId}`,
      pageStart: seedChapter?.start_page ?? 1,
      pageEnd: seedChapter?.end_page ?? 4,
      sourceBook: "Campbell-Walsh-Wein",
      sourceEdition: "13",
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!existingContractChapter) {
    await db.insert(contractChapters).values({
      id: contractChapterId,
      sourceId: "campbell",
      chapterNo: seedChapterNo,
      chapterTitle: seedChapterTitle,
      createdAt: now,
    });
  }

  await db.insert(noteDocuments).values({
    id: makeId("note_document"),
    docId,
    logicalChunkId: `smoke-chunk-${seedChapterNo}`,
    version: 1,
    chapterId: contractChapterId,
    chapterNo: seedChapterNo,
    chapterTitle: seedChapterTitle,
    chunkIndex: 1,
    pageRange: "1-4",
    generatedAt: now,
    ingestStatus: "active",
    createdAt: now,
  });

  await db.insert(noteSections).values({
    id: makeId("note_section"),
    sectionId,
    docId,
    orderIndex: 0,
    title: "Core concepts",
    hook: "Minimal seeded section",
    closingKeypoint: "Seeded for supported runtime smoke tests",
    createdAt: now,
  });

  await db.insert(noteFrames).values({
    id: makeId("note_frame"),
    frameId,
    docId,
    sectionId,
    orderIndex: 0,
    kind: "core",
    title: "Seeded frame",
    summary: "Minimal reader fixture",
    body: "This seeded frame validates the supported note reader path.",
    marginNote: null,
    createdAt: now,
  });

  return listNoteDocuments();
}

async function main() {
  const documents = await ensureMinimalReaderFixture();

  const [shellContext, dashboardLite, libraryDashboard, volumeSummaries, dataSettings] =
    await Promise.all([
      getAppShellContext(),
      getHostedDashboardLiteData(),
      getLibraryDashboardData(),
      getCampbellVolumeSummaries(),
      getDataSettingsSnapshot(),
    ]);

  if (!volumeSummaries.length) {
    throw new Error("Library smoke test could not find Campbell volume summaries.");
  }

  if (!documents.length) {
    throw new Error("Supported smoke test could not find any note documents.");
  }

  const firstDoc = documents[0];
  const [note, readerContext, relatedFlashcards, chapterDetail] = await Promise.all([
    getNoteByDocId(firstDoc.docId),
    getChapterReaderContextForDoc(firstDoc.docId),
    listReaderFlashcardsForDoc(firstDoc.docId),
    getCampbellChapterDetail(firstDoc.chapterNo),
  ]);

  if (!note) {
    throw new Error("Note reader smoke test failed to load the first document.");
  }

  if (!readerContext) {
    throw new Error("Reader context smoke test failed to resolve chapter navigation.");
  }

  if (!chapterDetail) {
    throw new Error("Library chapter detail smoke test failed for the first document chapter.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        shellContext: {
          notebookCount: shellContext.stats.notebooks,
          flashcardCount: shellContext.stats.flashcards,
          plannerEnabled: shellContext.capabilities.planner,
        },
        dashboardLite: {
          accuracy: dashboardLite.accuracy,
          studyTimeToday: dashboardLite.studyTimeToday,
        },
        library: {
          volumes: volumeSummaries.length,
          chapterCount: libraryDashboard.totalIncluded,
          documentCount: documents.length,
        },
        noteReader: {
          docId: firstDoc.docId,
          frameCount: note.stats.totalFrames,
          relatedFlashcards: relatedFlashcards.length,
        },
        settingsData: {
          runtime: dataSettings.runtime,
          supportedSlices: dataSettings.supportedSlices.map((slice) => slice.key),
        },
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
