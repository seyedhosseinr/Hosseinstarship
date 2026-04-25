import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/index";
import { contractChapters, yieldAnnotations } from "@/db/schema";
import type {
  YieldAnnotationRow,
  YieldCardViewModel,
  YieldSectionGroup,
  YieldViewModel,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON text field that may arrive as a string or already-parsed array.
 * The schema stores arrays as text; Drizzle's .$type<string[]>() is advisory only.
 */
function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string" && val.length > 0) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRowToViewModel(row: YieldAnnotationRow): YieldCardViewModel {
  const sectionTitles = parseJsonArray(row.sourceSectionTitles);
  return {
    id: row.id,
    title: row.summaryLabel,
    sectionTitle: sectionTitles[0] ?? "",
    allSectionTitles: sectionTitles,
    anchorHints: parseJsonArray(row.sourceAnchorHints),
    conceptLabels: parseJsonArray(row.conceptLabels),
    reasons: parseJsonArray(row.reasons),
    tier: row.yieldTier,
    isKeyExam: row.keyExamInfo === 1,
    isHighYield: row.highYieldVisible === 1,
    sourceNoteId: row.sourceDocId,
    chapterNo: row.chapterNo,
    segmentNo: row.segmentNo ?? null,
  };
}

const UNGROUPED_SECTION = "General";

function groupCardsIntoSections(cards: YieldCardViewModel[]): YieldSectionGroup[] {
  const sectionMap = new Map<string, YieldCardViewModel[]>();

  for (const card of cards) {
    const key = card.sectionTitle.trim() || UNGROUPED_SECTION;
    const existing = sectionMap.get(key) ?? [];
    existing.push(card);
    sectionMap.set(key, existing);
  }

  return Array.from(sectionMap.entries()).map(([sectionTitle, sectionCards]) => ({
    sectionTitle,
    cards: sectionCards,
  }));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch yield annotations for a specific note document.
 * Includes both doc-specific annotations and chapter-wide annotations
 * (where source_doc_id IS NULL) for the same chapter.
 */
export async function getYieldAnnotationsForDoc(
  docId: string,
  chapterNo: number,
): Promise<YieldViewModel> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(yieldAnnotations)
    .where(
      or(
        eq(yieldAnnotations.sourceDocId, docId),
        and(
          eq(yieldAnnotations.chapterNo, chapterNo),
          isNull(yieldAnnotations.sourceDocId),
        ),
      ),
    )
    .orderBy(asc(yieldAnnotations.yieldTier), asc(yieldAnnotations.createdAt));

  const cards = rows.map((row) => mapRowToViewModel(row as YieldAnnotationRow));
  const sections = groupCardsIntoSections(cards);

  return {
    chapterNo,
    docId,
    sections,
    totalCards: cards.length,
  };
}

/**
 * Fetch all yield annotations across every chapter, grouped by chapter.
 * Used by the standalone /yield page to show a full library-wide review view.
 * Chapters with zero annotations are excluded.
 */
export async function getAllYieldByChapter(): Promise<
  Array<{
    chapterNo: number;
    chapterTitle: string;
    sections: YieldSectionGroup[];
    totalCards: number;
  }>
> {
  const db = await getDb();

  const [rows, chapterRows] = await Promise.all([
    db
      .select()
      .from(yieldAnnotations)
      .orderBy(
        asc(yieldAnnotations.chapterNo),
        asc(yieldAnnotations.yieldTier),
        asc(yieldAnnotations.createdAt),
      ),
    db
      .select({
        chapterNo: contractChapters.chapterNo,
        chapterTitle: contractChapters.chapterTitle,
      })
      .from(contractChapters)
      .orderBy(asc(contractChapters.chapterNo)),
  ]);

  // Build a chapterNo → title map (first title wins if duplicates)
  const titleMap = new Map<number, string>();
  for (const ch of chapterRows) {
    if (!titleMap.has(ch.chapterNo)) {
      titleMap.set(ch.chapterNo, ch.chapterTitle);
    }
  }

  // Group cards by chapterNo
  const byChapter = new Map<number, YieldCardViewModel[]>();
  for (const row of rows) {
    const card = mapRowToViewModel(row as YieldAnnotationRow);
    const bucket = byChapter.get(row.chapterNo) ?? [];
    bucket.push(card);
    byChapter.set(row.chapterNo, bucket);
  }

  // Build result sorted by chapter number
  return Array.from(byChapter.entries())
    .sort(([a], [b]) => a - b)
    .map(([chapterNo, cards]) => ({
      chapterNo,
      chapterTitle: titleMap.get(chapterNo) ?? `Chapter ${chapterNo}`,
      sections: groupCardsIntoSections(cards),
      totalCards: cards.length,
    }));
}

/**
 * Fetch all yield annotations for a chapter (across all segments).
 * Used when rendering chapter-level YIELD view.
 */
export async function getYieldAnnotationsForChapter(
  chapterNo: number,
): Promise<YieldViewModel> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(yieldAnnotations)
    .where(eq(yieldAnnotations.chapterNo, chapterNo))
    .orderBy(asc(yieldAnnotations.yieldTier), asc(yieldAnnotations.createdAt));

  const cards = rows.map((row) => mapRowToViewModel(row as YieldAnnotationRow));
  const sections = groupCardsIntoSections(cards);

  return {
    chapterNo,
    docId: null,
    sections,
    totalCards: cards.length,
  };
}
