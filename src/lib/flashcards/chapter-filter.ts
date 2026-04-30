/**
 * Canonical chapter scoping for flashcard review.
 *
 * The flashcard schema stores the chapter as `flashcards.chapter_no`
 * (Drizzle: `chapterNo`). All review surfaces must agree on this single
 * field; otherwise a chapter-scoped queue (e.g. /flashcards/review?chapter=149)
 * will leak cards from other chapters.
 */

const FA_TO_EN_DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function toEnglishDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    out += FA_TO_EN_DIGITS[ch] ?? ch;
  }
  return out;
}

/**
 * Normalize any reasonable representation of a chapter selector to a
 * canonical numeric string ("149"). Returns null when the input does not
 * encode a chapter number.
 *
 * Accepts:
 *   - a positive integer:           149      -> "149"
 *   - a numeric string:             "149"    -> "149"
 *   - English-prefixed strings:     "Chapter 149", "ch. 149"
 *   - Persian-prefixed strings:     "فصل 149", "# فصل 149"
 *   - Persian/Arabic-Indic digits:  "۱۴۹"   -> "149"
 *
 * Anything that does not contain a positive integer (NaN, 0, negative,
 * empty, "all", undefined, null) returns null. null is the sentinel for
 * "no chapter scope" (i.e. global review).
 */
export function normalizeChapterKey(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const n = Math.trunc(value);
    return n > 0 ? String(n) : null;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const ascii = toEnglishDigits(trimmed);
  // Pull the first contiguous run of digits anywhere in the string.
  // This handles "Chapter 149", "فصل 149", "# فصل 149", "ch.149", etc.
  const match = ascii.match(/\d+/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(n);
}

export interface FlashcardChapterShape {
  chapterNo?: number | null;
  chapter_no?: number | null;
}

/**
 * Returns the canonical chapter key for a flashcard object, or null if
 * the card has no chapter assigned. Reads from the canonical
 * `chapterNo` field (or the snake_case `chapter_no` form used by the
 * local PGlite path).
 */
export function getFlashcardChapterKey(card: FlashcardChapterShape): string | null {
  const raw = card.chapterNo ?? card.chapter_no ?? null;
  return normalizeChapterKey(raw);
}

/**
 * True iff a flashcard belongs to the given chapter selector.
 *
 * - If `selectedChapter` normalizes to null (no scope), returns true for
 *   every card (global review).
 * - Otherwise returns true only for cards whose chapter key equals the
 *   normalized selector. Cards with no chapter (null) NEVER match a
 *   chapter-scoped selector.
 */
export function flashcardMatchesChapter(
  card: FlashcardChapterShape,
  selectedChapter: unknown,
): boolean {
  const target = normalizeChapterKey(selectedChapter);
  if (target == null) return true;
  const cardKey = getFlashcardChapterKey(card);
  return cardKey === target;
}

/**
 * Filter a list of flashcards down to those matching the selected chapter.
 * If `selectedChapter` is null/empty/non-numeric, returns the input unchanged.
 *
 * Use this as the LAST guard before cards enter the visible review queue
 * — it catches any leakage from upstream loaders that forgot to pass the
 * chapter scope.
 */
export function filterFlashcardsByChapter<T extends FlashcardChapterShape>(
  cards: T[],
  selectedChapter: unknown,
): T[] {
  const target = normalizeChapterKey(selectedChapter);
  if (target == null) return cards;
  return cards.filter((c) => getFlashcardChapterKey(c) === target);
}
