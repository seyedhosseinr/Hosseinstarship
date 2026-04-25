"use server";

import { revalidatePath } from "next/cache";

import {
  bulkSafeDeleteImportBatches,
  getExamLinkedQuestionCount,
  getImportBatchDetails,
  listImportSummaries,
  safeDeleteImportBatch,
} from "@/lib/import-light/admin";
import {
  importStructuredPayload,
  type StructuredImportContentType,
  type StructuredImportResult,
} from "@/lib/import-light/structured-import";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ImportSummary = {
  id: string;
  fileName: string | null;
  sourceName: string | null;
  sourceType: string | null;
  contentType: string | null;
  fileType: string | null;
  sourceVersion?: string | null;
  schemaVersion?: string | null;
  inputPath?: string | null;
  status?: string;
  startedAt?: number | null;
  completedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
  itemCount: number;
  chunkCount: number;
  noteDocumentCount: number;
  questionCount: number;
  flashcardCount: number;
  examLinkedQuestionCount: number;
  errorMessage?: string | null;
};

export type ImportBatchDetails = {
  import: ImportSummary;
  attemptedQuestionCount: number;
  reviewedFlashcardCount: number;
};

export type SafeDeleteResult = Awaited<ReturnType<typeof safeDeleteImportBatch>>;

export interface ImportStructuredResult extends StructuredImportResult {}

function safeRevalidateImportViews() {
  for (const path of ["/import", "/library", "/notes", "/flashcards", "/qbank", "/"]) {
    try {
      revalidatePath(path);
    } catch {
      // This action can be exercised outside a Next request context during verification.
    }
  }
}

function toImportSummary(
  row: Awaited<ReturnType<typeof listImportSummaries>>[number],
): ImportSummary {
  return {
    id: row.id,
    fileName: row.fileName ?? null,
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    contentType: row.contentType ?? null,
    fileType: row.fileType ?? null,
    sourceVersion: row.sourceVersion ?? null,
    schemaVersion: row.schemaVersion ?? null,
    inputPath: row.inputPath ?? null,
    status: row.status,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    itemCount: Number(row.itemCount ?? 0),
    chunkCount: row.chunkCount,
    noteDocumentCount: row.noteDocumentCount,
    questionCount: row.questionCount,
    flashcardCount: row.flashcardCount,
    examLinkedQuestionCount: row.examLinkedQuestionCount,
    errorMessage: row.errorMessage ?? null,
  };
}

export async function getImportHistoryAction(limit = 24): Promise<ActionResult<ImportSummary[]>> {
  try {
    const history = await listImportSummaries(limit);
    return {
      success: true,
      data: history.map(toImportSummary),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load import history.",
    };
  }
}

export async function getImportBatchDetailsAction(importId: string): Promise<ActionResult<ImportBatchDetails>> {
  try {
    const details = await getImportBatchDetails(importId);

    if (!details) {
      return { success: false, error: "Import batch not found." };
    }

    return {
      success: true,
      data: {
        import: toImportSummary(details.import),
        attemptedQuestionCount: details.attemptedQuestionCount,
        reviewedFlashcardCount: details.reviewedFlashcardCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load import batch details.",
    };
  }
}

export async function checkImportDependenciesAction(
  importId: string,
): Promise<ActionResult<{ examLinkedQuestions: number }>> {
  try {
    return {
      success: true,
      data: {
        examLinkedQuestions: await getExamLinkedQuestionCount(importId),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to inspect import dependencies.",
    };
  }
}

export async function deleteImportBatchAction(importId: string): Promise<ActionResult<SafeDeleteResult>> {
  try {
    return {
      success: true,
      data: await safeDeleteImportBatch(importId),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Import cleanup failed.",
    };
  }
}

export async function bulkDeleteImportBatchesAction(
  importIds: string[],
): Promise<ActionResult<SafeDeleteResult[]>> {
  try {
    return {
      success: true,
      data: await bulkSafeDeleteImportBatches(importIds),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bulk import cleanup failed.",
    };
  }
}

export async function importStructuredContentAction(params: {
  type: StructuredImportContentType | "notebooks";
  fileName: string;
  sourceType?: string;
  items: Record<string, unknown>[];
}): Promise<ActionResult<ImportStructuredResult>> {
  try {
    const contentType: StructuredImportContentType =
      params.type === "notebooks" ? "notes" : params.type;

    const data = await importStructuredPayload({
      fileName: params.fileName,
      contentType,
      format: "json",
      items: params.items,
      sourceType: params.sourceType ?? "manual",
    });

    safeRevalidateImportViews();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Structured import failed.",
    };
  }
}
