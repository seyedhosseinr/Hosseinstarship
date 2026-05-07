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

/**
 * Extract chapter and segment numbers from a filename or path string.
 * Mirrors the client-side parseFileMeta in ContentManager.tsx so we can
 * return structured data from the server.
 */
export function extractChapterSegment(name: string | null | undefined): {
  chapterNo: number | null;
  segmentNo: number | null;
} {
  if (!name) return { chapterNo: null, segmentNo: null };

  const base = name
    .replace(/\.[^.]+$/, "")          // strip extension
    .replace(/^.*[\\/]/, "");          // strip directory prefix

  let chapterNo: number | null = null;
  let segmentNo: number | null = null;

  // Pattern A: "<chapter>_<segment>" — e.g. ch149_03, 149_03, chapter-149-03
  const chSegMatch = base.match(/^(?:ch(?:apter)?[_-]?)?(\d{1,3})[_-](\d{1,3})(?=[_-]|$)/i);
  if (chSegMatch) {
    const chN = parseInt(chSegMatch[1], 10);
    const segN = parseInt(chSegMatch[2], 10);
    if (chN > 0 && chN <= 244) chapterNo = chN;
    if (segN >= 0 && segN <= 99) segmentNo = segN;
  }

  // Pattern B: explicit chapter keyword — e.g. ch149, chapter149, chapter_149
  if (chapterNo == null) {
    const chMatch = base.match(/(?:ch(?:apter)?[_-]?)(\d{1,3})/i);
    const trailMatch = base.match(/[_-](\d{1,3})(?:[_-]|$)/);
    const leadMatch = base.match(/^(\d{1,3})[_-]/);
    const chStr = chMatch?.[1] ?? trailMatch?.[1] ?? leadMatch?.[1];
    if (chStr) {
      const n = parseInt(chStr, 10);
      if (n > 0 && n <= 244) chapterNo = n;
    }
  }

  // Pattern C: explicit segment keyword — e.g. seg03, seg_3, s03
  if (segmentNo == null) {
    const segMatch = base.match(/(?:seg(?:ment)?[_-]?|_s)(\d{1,3})(?=[_-]|$)/i);
    if (segMatch) {
      const n = parseInt(segMatch[1], 10);
      if (n >= 0 && n <= 99) segmentNo = n;
    }
  }

  return { chapterNo, segmentNo };
}

function toHistoryEntry(row: Awaited<ReturnType<typeof listImportSummaries>>[number]): ImportHistoryEntry {
  // Prefer inputPath over fileName for chapter/segment extraction as it often
  // contains a richer path like ".../ch149_seg03/mcq.json".
  const { chapterNo, segmentNo } = extractChapterSegment(
    row.inputPath ?? row.fileName ?? row.sourceName,
  );

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
    chapterNo,
    segmentNo,
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
