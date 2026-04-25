import { and, count, eq, lte, sql } from "drizzle-orm";
import { getDb, getDbRuntime } from "@/db/index";
import { flashcards, noteDocuments, questions } from "@/db/schema";
import { SUPPORTED_RUNTIME_CAPABILITIES, type RuntimeCapabilities } from "@/lib/runtime/capabilities";

export type AppShellCapabilities = RuntimeCapabilities;

export type AppShellContext = {
  databaseTarget: "postgres" | "pglite";
  stats: {
    flashcards: number;
    questions: number;
    notebooks: number;
    exams: number;
    avgScore: number;
    dueFlashcards: number;
  };
  capabilities: AppShellCapabilities;
};

const EMPTY_APP_SHELL_STATS = {
  flashcards: 0,
  questions: 0,
  notebooks: 0,
  exams: 0,
  avgScore: 0,
  dueFlashcards: 0,
} satisfies AppShellContext["stats"];

function getFallbackAppShellContext(): AppShellContext {
  return {
    databaseTarget: getDbRuntime(),
    stats: EMPTY_APP_SHELL_STATS,
    capabilities: SUPPORTED_RUNTIME_CAPABILITIES,
  };
}

export async function getAppShellContext(): Promise<AppShellContext> {
  if (process.env.NODE_ENV === "development" && getDbRuntime() === "pglite") {
    return getFallbackAppShellContext();
  }

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch (error) {
    if (getDbRuntime() === "pglite") {
      const reason = error instanceof Error ? error.message : "Unknown local database error.";
      console.warn(`[app-shell] Using empty shell context because local PGlite is unavailable: ${reason}`);
      return getFallbackAppShellContext();
    }

    throw error;
  }

  const now = Date.now();
  const [questionRow, flashcardRow, notebookRow, dueRow] = await Promise.all([
    db.select({ value: count(questions.id) }).from(questions).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(eq(flashcards.isArchived, 0)).limit(1),
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${noteDocuments.docId})` })
      .from(noteDocuments)
      .where(eq(noteDocuments.ingestStatus, "active"))
      .limit(1),
    db
      .select({ value: count(flashcards.id) })
      .from(flashcards)
      .where(
        and(
          eq(flashcards.isArchived, 0),
          eq(flashcards.status, "active"),
          eq(flashcards.isSuspended, 0),
          eq(flashcards.isBuried, 0),
          lte(flashcards.fsrsDue, now),
        ),
      )
      .limit(1),
  ]);

  return {
    databaseTarget: getDbRuntime(),
    stats: {
      ...EMPTY_APP_SHELL_STATS,
      questions: questionRow[0]?.value ?? 0,
      flashcards: flashcardRow[0]?.value ?? 0,
      notebooks: notebookRow[0]?.value ?? 0,
      dueFlashcards: dueRow[0]?.value ?? 0,
    },
    capabilities: SUPPORTED_RUNTIME_CAPABILITIES,
  };
}
