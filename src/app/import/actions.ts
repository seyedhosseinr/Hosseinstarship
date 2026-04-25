"use server";

import { revalidatePath } from "next/cache";

import { getDbRuntime } from "@/db/index";
import { runBatchImport } from "@/lib/import-light/batch-import";
import { safeListRecentImports } from "@/lib/import-light/queries";
import {
  importStructuredPayload,
  type StructuredImportContentType,
  type StructuredImportFormat,
} from "@/lib/import-light/structured-import";
import type { ImportActionState } from "@/lib/import-light/types";

const DEFAULT_BATCH_DIRECTORY = "data/test-batch";

function safeRevalidateImportViews() {
  for (const path of ["/import", "/library", "/notes", "/flashcards", "/qbank", "/settings/data", "/"]) {
    try {
      revalidatePath(path);
    } catch {
      // In CLI / tsx verification there is no Next static generation store.
    }
  }
}

export async function submitImportBatch(
  _previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const runtime = getDbRuntime();
  const batchDirectory =
    String(formData.get("batchDirectory") ?? DEFAULT_BATCH_DIRECTORY).trim() ||
    DEFAULT_BATCH_DIRECTORY;

  try {
    const result = await runBatchImport(batchDirectory);
    const historyResult = await safeListRecentImports(12, "submitImportBatch:historyRefresh");
    safeRevalidateImportViews();

    return {
      ok: true,
      batchDirectory,
      runtime,
      message: "Batch import completed successfully.",
      error: null,
      snapshotError: historyResult.error,
      result,
      history: historyResult.history,
    };
  } catch (error) {
    const historyResult = await safeListRecentImports(12, "submitImportBatch:historyRefresh");

    return {
      ok: false,
      batchDirectory,
      runtime,
      message: null,
      error: error instanceof Error ? error.message : "Import failed.",
      snapshotError: historyResult.error,
      result: null,
      history: historyResult.history,
    };
  }
}

export type UploadImportResult = {
  ok: boolean;
  message: string;
  inserted: number;
  errors: string[];
  fileResults: UploadImportFileResult[];
  successfulFiles: number;
  failedFiles: number;
};

export type UploadImportFileResult = {
  fileName: string;
  format: StructuredImportFormat | null;
  ok: boolean;
  inserted: number;
  message: string;
  errors: string[];
};

function detectStructuredFormatFromExtension(fileName: string): StructuredImportFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "json" || ext === "csv" || ext === "html" || ext === "htm") {
    return ext === "htm" ? "html" : ext;
  }

  return null;
}

function looksLikeJson(rawText: string) {
  const trimmed = rawText.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function looksLikeHtml(rawText: string) {
  const trimmed = rawText.trimStart();

  return (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<\/?(html|body|section|article|main|header|footer|div|p|h[1-6]|ul|ol|table|figure|aside|span)\b/i.test(trimmed)
  );
}

function detectStructuredFormat(params: {
  fileName: string;
  contentType: StructuredImportContentType;
  rawText: string;
}): StructuredImportFormat | null {
  const extensionFormat = detectStructuredFormatFromExtension(params.fileName);

  if (params.contentType === "notes") {
    if (extensionFormat === "html") return "html";
    if (extensionFormat === "json") {
      return looksLikeHtml(params.rawText) && !looksLikeJson(params.rawText) ? "html" : "json";
    }
    if (looksLikeHtml(params.rawText)) return "html";
    if (looksLikeJson(params.rawText)) return "json";
    return null;
  }

  // yield is JSON-only
  if (params.contentType === "yield") {
    if (extensionFormat === "json" || looksLikeJson(params.rawText)) return "json";
    return null;
  }

  if (extensionFormat === "json" || extensionFormat === "csv") {
    return extensionFormat;
  }
  if (looksLikeJson(params.rawText)) return "json";
  if (params.rawText.includes(",") && /\r?\n/.test(params.rawText)) return "csv";
  return null;
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  const candidate = value as Partial<File> | null;

  return (
    value instanceof File ||
    (!!candidate &&
      typeof candidate === "object" &&
      typeof candidate.name === "string" &&
      typeof candidate.text === "function")
  );
}

function getUploadFiles(formData: FormData) {
  const entries = formData.getAll("files");
  if (entries.length > 0) {
    return entries.filter(isUploadFile);
  }

  const legacyEntry = formData.get("file");
  return isUploadFile(legacyEntry) ? [legacyEntry] : [];
}

/**
 * Direct text-based import — avoids FormData/File/Blob serialization issues.
 * The client reads file.text() and sends the raw string directly.
 */
export async function importFileDirectly(
  contentType: StructuredImportContentType,
  fileName: string,
  rawText: string,
): Promise<UploadImportFileResult> {
  try {
    const format = detectStructuredFormat({ fileName, contentType, rawText });
    if (!format) {
      return {
        fileName,
        format: null,
        ok: false,
        inserted: 0,
        message: `Unsupported format for ${contentType}.`,
        errors: [],
      };
    }

    const result = await importStructuredPayload({
      fileName,
      contentType,
      format,
      rawText,
      sourceType: "manual",
    });

    safeRevalidateImportViews();

    return {
      fileName,
      format,
      ok: true,
      inserted: result.importedCount,
      message: `${result.importedCount} item(s) imported.`,
      errors: result.errors,
    };
  } catch (error) {
    return {
      fileName,
      format: null,
      ok: false,
      inserted: 0,
      message: error instanceof Error ? error.message : "Unknown import error.",
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

export async function uploadImportFile(
  formData: FormData,
): Promise<UploadImportResult> {
  const files = getUploadFiles(formData);
  const contentType = formData.get("contentType") as StructuredImportContentType | null;

  if (files.length === 0 || !contentType) {
    return {
      ok: false,
      message: "At least one file and a content type are required.",
      inserted: 0,
      errors: [],
      fileResults: [],
      successfulFiles: 0,
      failedFiles: 0,
    };
  }

  if (!["notes", "questions", "flashcards", "yield"].includes(contentType)) {
    return {
      ok: false,
      message: "Unsupported content type.",
      inserted: 0,
      errors: [],
      fileResults: [],
      successfulFiles: 0,
      failedFiles: 0,
    };
  }

  const fileResults: UploadImportFileResult[] = [];

  for (const file of files) {
    try {
      const rawText = await file.text();
      const format = detectStructuredFormat({
        fileName: file.name,
        contentType,
        rawText,
      });

      if (!format) {
        const unsupportedMessage =
          contentType === "notes"
            ? "Notes support JSON and HTML uploads."
            : contentType === "yield"
              ? "Yield cards support JSON uploads."
              : `${contentType === "questions" ? "MCQs" : "Flashcards"} support JSON and CSV uploads.`;
        fileResults.push({
          fileName: file.name,
          format: null,
          ok: false,
          inserted: 0,
          message: unsupportedMessage,
          errors: [],
        });
        continue;
      }

      const result = await importStructuredPayload({
        fileName: file.name,
        contentType,
        format,
        rawText,
        sourceType: "manual",
      });

      fileResults.push({
        fileName: file.name,
        format,
        ok: true,
        inserted: result.importedCount,
        message: `${result.importedCount} item(s) imported.`,
        errors: result.errors,
      });
    } catch (error) {
      fileResults.push({
        fileName: file.name,
        format: null,
        ok: false,
        inserted: 0,
        message: error instanceof Error ? error.message : "Unknown upload error.",
        errors: [],
      });
    }
  }

  const successfulFiles = fileResults.filter((result) => result.ok).length;
  const failedFiles = fileResults.length - successfulFiles;
  const inserted = fileResults.reduce((sum, result) => sum + result.inserted, 0);
  const errors = fileResults.flatMap((result) =>
    result.ok
      ? result.errors.map((message) => `${result.fileName}: ${message}`)
      : [`${result.fileName}: ${result.message}`],
  );

  if (successfulFiles > 0) {
    safeRevalidateImportViews();
  }

  const message =
    successfulFiles === 0
      ? `No files were imported. ${failedFiles} file(s) failed.`
      : failedFiles === 0
        ? `Imported ${inserted} item(s) from ${successfulFiles} file(s).`
        : `Imported ${inserted} item(s) from ${successfulFiles} file(s); ${failedFiles} file(s) failed.`;

  return {
    ok: successfulFiles > 0,
    message,
    inserted,
    errors,
    fileResults,
    successfulFiles,
    failedFiles,
  };
}
