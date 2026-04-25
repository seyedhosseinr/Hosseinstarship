/**
 * Chapter-aware filename parser for the import system.
 *
 * Supported patterns:
 *   149-1.html      → chapter 149, segment 1, note
 *   149-1_q.html    → chapter 149, segment 1, question
 *   149-2_f.json    → chapter 149, segment 2, flashcard
 *
 * Regex: /^(\d+)-(\d+)(?:_(q|f))?\.(html|htm|json|csv)$/i
 *
 * Returns null for any filename that does not match — callers must fall back
 * to normal import without throwing an error.
 */

export type ContentKind = "note" | "question" | "flashcard";

export interface ParsedChapterFile {
  chapterNo: number;
  segmentNo: number;
  contentKind: ContentKind;
  extension: "html" | "htm" | "json" | "csv";
  originalFileName: string;
}

const CHAPTER_FILE_RE = /^(\d+)-(\d+)(?:_(q|f))?\.(html|htm|json|csv)$/i;

export function parseChapterFilename(
  filename: string,
): ParsedChapterFile | null {
  const m = CHAPTER_FILE_RE.exec(filename);
  if (!m) return null;

  const chapterNo = parseInt(m[1], 10);
  const segmentNo = parseInt(m[2], 10);

  const kindSuffix = m[3]?.toLowerCase() ?? null;
  let contentKind: ContentKind;
  if (kindSuffix === "q") contentKind = "question";
  else if (kindSuffix === "f") contentKind = "flashcard";
  else contentKind = "note";

  const extension = m[4].toLowerCase() as ParsedChapterFile["extension"];

  return {
    chapterNo,
    segmentNo,
    contentKind,
    extension,
    originalFileName: filename,
  };
}
