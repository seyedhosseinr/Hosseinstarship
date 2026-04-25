import { and, count, eq, isNotNull, lte } from "drizzle-orm";

import { getDb } from "@/db/index";
import { getDatabaseConfig } from "@/db/config";
import {
  chapters,
  flashcards,
  noteDocuments,
  planStatus,
  studyPlans,
  studyTasks,
  taskStatus,
} from "@/db/schema";
import { SUPPORTED_RUNTIME_CAPABILITIES } from "@/lib/runtime/capabilities";

export type DataSettingsSnapshot = {
  runtime: "postgres" | "pglite";
  storageLabel: string;
  counts: {
    chapters: number;
    documents: number;
    flashcards: number;
    dueFlashcards: number;
    activePlans: number;
    queuedPlannerTasks: number;
  };
  supportedSlices: Array<{ key: string; label: string }>;
  unavailableOperations: string[];
};

export async function getDataSettingsSnapshot(): Promise<DataSettingsSnapshot> {
  const db = await getDb();
  const config = getDatabaseConfig();
  const now = Date.now();

  const [
    chapterRows,
    documentRows,
    flashcardRows,
    dueFlashcardRows,
    activePlanRows,
    queuedPlannerRows,
  ] = await Promise.all([
    db.select({ count: count(chapters.id) }).from(chapters),
    db.select({ count: count(noteDocuments.docId) }).from(noteDocuments),
    db.select({ count: count(flashcards.id) }).from(flashcards),
    db
      .select({ count: count(flashcards.id) })
      .from(flashcards)
      .where(
        and(
          eq(flashcards.isArchived, 0),
          eq(flashcards.isSuspended, 0),
          isNotNull(flashcards.fsrsDue),
          lte(flashcards.fsrsDue, now),
        ),
      ),
    db
      .select({ count: count(studyPlans.id) })
      .from(studyPlans)
      .where(eq(studyPlans.status, planStatus.active)),
    db
      .select({ count: count(studyTasks.id) })
      .from(studyTasks)
      .where(and(eq(studyTasks.status, taskStatus.pending), isNotNull(studyTasks.scheduledFor))),
  ]);

  const supportedSlices = [
    SUPPORTED_RUNTIME_CAPABILITIES.dashboard ? { key: "dashboard-lite", label: "Dashboard-lite" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.library ? { key: "library", label: "Library" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.library ? { key: "library-progress", label: "Library progress" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.library ? { key: "note-reader", label: "Note reader" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.library ? { key: "reader-flashcards", label: "Reader flashcard lookup" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.flashcards ? { key: "flashcards-core", label: "Flashcards core" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.planner ? { key: "planner-reduced", label: "Planner reduced execution" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.history ? { key: "history-light", label: "History light" } : null,
    SUPPORTED_RUNTIME_CAPABILITIES.import ? { key: "import-light", label: "Import/admin light" } : null,
    { key: "app-shell", label: "App shell context" },
    SUPPORTED_RUNTIME_CAPABILITIES.settings ? { key: "settings-data", label: "Settings/data light" } : null,
  ].filter((slice): slice is { key: string; label: string } => slice !== null);

  return {
    runtime: config.runtime,
    storageLabel:
      config.runtime === "postgres"
        ? "Hosted Postgres runtime"
        : `Local PGlite runtime at ${config.pgliteLocation ?? ".pglite/starship"}`,
    counts: {
      chapters: Number(chapterRows[0]?.count ?? 0),
      documents: Number(documentRows[0]?.count ?? 0),
      flashcards: Number(flashcardRows[0]?.count ?? 0),
      dueFlashcards: Number(dueFlashcardRows[0]?.count ?? 0),
      activePlans: Number(activePlanRows[0]?.count ?? 0),
      queuedPlannerTasks: Number(queuedPlannerRows[0]?.count ?? 0),
    },
    supportedSlices,
    unavailableOperations: [
      "Flashcard backup/export",
      "Flashcard legacy migration",
      "Browser upload and legacy import generation",
      "Exam and QBank data tooling",
    ],
  };
}
