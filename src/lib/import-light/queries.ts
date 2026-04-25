import { getDbRuntime } from "@/db/index";
import { listImportSummaries } from "@/lib/import-light/admin";

import type { ImportHistoryEntry } from "./types";

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatImportHistoryLoadError(context: string, error: unknown) {
  return `Recent import history query failed on /import (${context} -> listRecentImports -> SELECT from imports): ${describeError(error)}`;
}

function toHistoryEntry(row: Awaited<ReturnType<typeof listImportSummaries>>[number]): ImportHistoryEntry {
  return {
    id: row.id,
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    sourceVersion: row.sourceVersion ?? null,
    schemaVersion: row.schemaVersion,
    status: row.status,
    fileName: row.fileName ?? null,
    fileType: row.fileType ?? null,
    contentType: row.contentType ?? null,
    inputPath: row.inputPath ?? null,
    itemCount: Number(row.itemCount ?? 0),
    chunkCount: row.chunkCount,
    noteDocumentCount: row.noteDocumentCount,
    questionCount: row.questionCount,
    flashcardCount: row.flashcardCount,
    examLinkedQuestionCount: row.examLinkedQuestionCount,
    errorMessage: row.errorMessage ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listRecentImports(limit = 12): Promise<ImportHistoryEntry[]> {
  const rows = await listImportSummaries(limit);
  return rows.map(toHistoryEntry);
}

export async function safeListRecentImports(
  limit = 12,
  context = "getImportPageSnapshot",
): Promise<{
  history: ImportHistoryEntry[];
  error: string | null;
}> {
  try {
    return {
      history: await listRecentImports(limit),
      error: null,
    };
  } catch (error) {
    return {
      history: [],
      error: formatImportHistoryLoadError(context, error),
    };
  }
}

export async function getImportPageSnapshot() {
  const historyResult = await safeListRecentImports(12, "getImportPageSnapshot");

  return {
    runtime: getDbRuntime(),
    history: historyResult.history,
    historyError: historyResult.error,
  };
}
