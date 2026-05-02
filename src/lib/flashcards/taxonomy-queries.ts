/**
 * Flashcard queries organized by Campbell taxonomy hierarchy.
 * Provides counts, listings, and search across volume > part > chapter structure.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/db/index";
import { chapters, flashcards, questions } from "@/db/schema";
import {
  getCampbellVolumes,
  type CampbellVolume,
} from "@/lib/exam/campbell-hierarchy";
import { getCampbellChapter as getCampbellChapterRaw } from "@/lib/library/campbell";
import { buildReaderSourceHref } from "@/lib/reader/anchor-bubble";
import { parseStringArray } from "./queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HierarchyNode = {
  id: string;
  label: string;
  type: "volume" | "part" | "chapter";
  volumeNo?: number;
  chapterNo?: number;
  total: number;
  due: number;
  newCount: number;
  learning: number;
  children?: HierarchyNode[];
};

export type FlashcardListRow = {
  id: string;
  frontHtml: string;
  backHtml: string;
  cardType: string;
  chapterNo: number | null;
  chapterTitle: string | null;
  deck: string | null;
  tags: string[];
  fsrsState: string;
  fsrsDue: number | null;
  isLeech: boolean;
  isSuspended: boolean;
  sourceDocId: string | null;
  sourceFrameId: string | null;
  sourceQuestionId: string | null;
  importance: number;
  updatedAt: number;
};

export type ConceptCluster = {
  deck: string;
  cards: FlashcardListRow[];
  total: number;
  due: number;
};

export type FlashcardSourceContext = {
  card: FlashcardListRow | null;
  chapterMeta: {
    chapterNo: number;
    title: string;
    volume: number;
    part: string;
  } | null;
  relatedCards: Array<{ id: string; frontHtml: string; fsrsState: string }>;
  relatedQuestionCount: number;
  noteDocHref: string | null;
};

export type SearchResult = {
  id: string;
  frontHtml: string;
  backHtml: string;
  chapterNo: number | null;
  chapterTitle: string | null;
  deck: string | null;
  matchField: "front" | "back" | "deck" | "chapter";
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ACTIVE_CARD_FILTERS: SQL[] = [
  eq(flashcards.status, "active"),
  eq(flashcards.isArchived, 0),
];

function toListRow(row: {
  card: typeof flashcards.$inferSelect;
  chapterTitle: string | null;
}): FlashcardListRow {
  return {
    id: row.card.id,
    frontHtml: row.card.frontHtml,
    backHtml: row.card.backHtml,
    cardType: row.card.cardType,
    chapterNo: row.card.chapterNo,
    chapterTitle: row.chapterTitle ?? null,
    deck: row.card.deck,
    tags: parseStringArray(row.card.tagsJson),
    fsrsState: row.card.fsrsState,
    fsrsDue: row.card.fsrsDue,
    isLeech: Boolean(row.card.isLeech),
    isSuspended: Boolean(row.card.isSuspended),
    sourceDocId: row.card.sourceDocId ?? null,
    sourceFrameId: row.card.sourceFrameId ?? null,
    sourceQuestionId: row.card.sourceQuestionId ?? null,
    importance: row.card.importance,
    updatedAt: row.card.updatedAt,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// 1. getFlashcardHierarchyCounts
// ---------------------------------------------------------------------------

type ChapterStateRow = {
  chapterNo: number | null;
  fsrsState: string;
  cnt: number;
};

type ChapterDueRow = {
  chapterNo: number | null;
  dueCnt: number;
};

type ChapterCounts = {
  total: number;
  due: number;
  newCount: number;
  learning: number;
};

export async function getFlashcardHierarchyCounts(): Promise<HierarchyNode[]> {
  const db = await getDb();
  const now = Date.now();

  // One query: counts grouped by chapterNo + fsrsState (active, non-archived only)
  const stateRows: ChapterStateRow[] = (
    await db
      .select({
        chapterNo: flashcards.chapterNo,
        fsrsState: flashcards.fsrsState,
        cnt: count(flashcards.id),
      })
      .from(flashcards)
      .where(and(...ACTIVE_CARD_FILTERS))
      .groupBy(flashcards.chapterNo, flashcards.fsrsState)
  ).map((r) => ({
    chapterNo: r.chapterNo,
    fsrsState: r.fsrsState,
    cnt: Number(r.cnt),
  }));

  // One query: due counts per chapter (active, non-archived, non-suspended, non-buried, due <= now)
  const dueRows: ChapterDueRow[] = (
    await db
      .select({
        chapterNo: flashcards.chapterNo,
        dueCnt: count(flashcards.id),
      })
      .from(flashcards)
      .where(
        and(
          ...ACTIVE_CARD_FILTERS,
          eq(flashcards.isSuspended, 0),
          eq(flashcards.isBuried, 0),
          lte(flashcards.fsrsDue, now),
        ),
      )
      .groupBy(flashcards.chapterNo)
  ).map((r) => ({
    chapterNo: r.chapterNo,
    dueCnt: Number(r.dueCnt),
  }));

  // Build lookup maps
  const countsMap = new Map<number, ChapterCounts>();

  for (const row of stateRows) {
    if (row.chapterNo == null) continue;
    const existing = countsMap.get(row.chapterNo) ?? {
      total: 0,
      due: 0,
      newCount: 0,
      learning: 0,
    };
    existing.total += row.cnt;
    if (row.fsrsState === "new") existing.newCount += row.cnt;
    if (row.fsrsState === "learning" || row.fsrsState === "relearning") {
      existing.learning += row.cnt;
    }
    countsMap.set(row.chapterNo, existing);
  }

  for (const row of dueRows) {
    if (row.chapterNo == null) continue;
    const existing = countsMap.get(row.chapterNo);
    if (existing) {
      existing.due = row.dueCnt;
    }
  }

  // Map onto Campbell hierarchy
  const volumes: CampbellVolume[] = getCampbellVolumes();
  const result: HierarchyNode[] = [];

  for (const vol of volumes) {
    const volNode: HierarchyNode = {
      id: vol.id,
      label: vol.label,
      type: "volume",
      volumeNo: vol.volumeNo,
      total: 0,
      due: 0,
      newCount: 0,
      learning: 0,
      children: [],
    };

    for (const part of vol.parts) {
      const partNode: HierarchyNode = {
        id: part.id,
        label: part.label,
        type: "part",
        volumeNo: vol.volumeNo,
        total: 0,
        due: 0,
        newCount: 0,
        learning: 0,
        children: [],
      };

      for (const ch of part.chapters) {
        const c = countsMap.get(ch.chapterNo) ?? {
          total: 0,
          due: 0,
          newCount: 0,
          learning: 0,
        };

        const chapterNode: HierarchyNode = {
          id: ch.id,
          label: ch.title,
          type: "chapter",
          volumeNo: vol.volumeNo,
          chapterNo: ch.chapterNo,
          total: c.total,
          due: c.due,
          newCount: c.newCount,
          learning: c.learning,
        };

        partNode.children!.push(chapterNode);
        partNode.total += c.total;
        partNode.due += c.due;
        partNode.newCount += c.newCount;
        partNode.learning += c.learning;
      }

      volNode.children!.push(partNode);
      volNode.total += partNode.total;
      volNode.due += partNode.due;
      volNode.newCount += partNode.newCount;
      volNode.learning += partNode.learning;
    }

    result.push(volNode);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. listFlashcardsByChapter
// ---------------------------------------------------------------------------

export async function listFlashcardsByChapter(
  chapterNo: number,
  opts?: {
    limit?: number;
    offset?: number;
    dueOnly?: boolean;
    stateFilter?: string;
  },
): Promise<FlashcardListRow[]> {
  const db = await getDb();
  const now = Date.now();

  const filters: SQL[] = [
    ...ACTIVE_CARD_FILTERS,
    eq(flashcards.chapterNo, chapterNo),
  ];

  if (opts?.dueOnly) {
    filters.push(eq(flashcards.isSuspended, 0));
    filters.push(eq(flashcards.isBuried, 0));
    filters.push(lte(flashcards.fsrsDue, now));
  }

  if (opts?.stateFilter) {
    filters.push(eq(flashcards.fsrsState, opts.stateFilter));
  }

  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;

  const rows = await db
    .select({
      card: flashcards,
      chapterTitle: chapters.title,
    })
    .from(flashcards)
    .leftJoin(chapters, eq(flashcards.chapterNo, chapters.chapterNo))
    .where(and(...filters))
    .orderBy(asc(flashcards.fsrsDue), desc(flashcards.importance), desc(flashcards.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows.map(toListRow);
}

// ---------------------------------------------------------------------------
// 3. getFlashcardConceptClusters
// ---------------------------------------------------------------------------

export async function getFlashcardConceptClusters(
  chapterNo: number,
): Promise<ConceptCluster[]> {
  const db = await getDb();
  const now = Date.now();

  // Get all active cards for the chapter with their chapter title
  const rows = await db
    .select({
      card: flashcards,
      chapterTitle: chapters.title,
    })
    .from(flashcards)
    .leftJoin(chapters, eq(flashcards.chapterNo, chapters.chapterNo))
    .where(
      and(
        ...ACTIVE_CARD_FILTERS,
        eq(flashcards.chapterNo, chapterNo),
      ),
    )
    .orderBy(asc(flashcards.deck), asc(flashcards.fsrsDue));

  // Group by deck
  const deckMap = new Map<string, FlashcardListRow[]>();

  for (const row of rows) {
    const card = toListRow(row);
    const deckKey = card.deck ?? "(no deck)";
    const existing = deckMap.get(deckKey);
    if (existing) {
      existing.push(card);
    } else {
      deckMap.set(deckKey, [card]);
    }
  }

  const clusters: ConceptCluster[] = [];

  for (const [deck, cards] of deckMap) {
    const due = cards.filter(
      (c) =>
        !c.isSuspended &&
        c.fsrsDue != null &&
        c.fsrsDue <= now,
    ).length;

    clusters.push({
      deck,
      cards,
      total: cards.length,
      due,
    });
  }

  // Sort by total descending
  clusters.sort((a, b) => b.total - a.total);

  return clusters;
}

// ---------------------------------------------------------------------------
// 4. getFlashcardSourceContext
// ---------------------------------------------------------------------------

export async function getFlashcardSourceContext(
  flashcardId: string,
): Promise<FlashcardSourceContext> {
  const db = await getDb();

  // Fetch the card
  const cardRows = await db
    .select({
      card: flashcards,
      chapterTitle: chapters.title,
    })
    .from(flashcards)
    .leftJoin(chapters, eq(flashcards.chapterNo, chapters.chapterNo))
    .where(eq(flashcards.id, flashcardId))
    .limit(1);

  if (cardRows.length === 0) {
    return {
      card: null,
      chapterMeta: null,
      relatedCards: [],
      relatedQuestionCount: 0,
      noteDocHref: null,
    };
  }

  const card = toListRow(cardRows[0]);

  // Chapter metadata from Campbell hierarchy
  let chapterMeta: FlashcardSourceContext["chapterMeta"] = null;

  if (card.chapterNo != null) {
    const campbellChapter = getCampbellChapterRaw(card.chapterNo);
    if (campbellChapter) {
      chapterMeta = {
        chapterNo: campbellChapter.chapter,
        title: campbellChapter.title,
        volume: campbellChapter.volume,
        part: campbellChapter.part,
      };
    }
  }

  // Related cards: same chapter + same deck (if both exist)
  let relatedCards: FlashcardSourceContext["relatedCards"] = [];

  if (card.chapterNo != null && card.deck != null) {
    const relatedRows = await db
      .select({
        id: flashcards.id,
        frontHtml: flashcards.frontHtml,
        fsrsState: flashcards.fsrsState,
      })
      .from(flashcards)
      .where(
        and(
          ...ACTIVE_CARD_FILTERS,
          eq(flashcards.chapterNo, card.chapterNo),
          eq(flashcards.deck, card.deck),
          sql`${flashcards.id} != ${flashcardId}`,
        ),
      )
      .orderBy(asc(flashcards.fsrsDue))
      .limit(20);

    relatedCards = relatedRows.map((r) => ({
      id: r.id,
      frontHtml: r.frontHtml,
      fsrsState: r.fsrsState,
    }));
  }

  // Related question count: questions in the same chapter
  let relatedQuestionCount = 0;

  if (card.chapterNo != null) {
    // questions table uses chapterId, so join through chapters to match by chapterNo
    const qCountRows = await db
      .select({ value: count(questions.id) })
      .from(questions)
      .innerJoin(chapters, eq(questions.chapterId, chapters.id))
      .where(
        and(
          eq(chapters.chapterNo, card.chapterNo),
          eq(questions.isActive, 1),
        ),
      );

    relatedQuestionCount = Number(qCountRows[0]?.value ?? 0);
  }

  // Reader href: prefer Library Chapter Reader when chapterNo is available,
  // otherwise fall back to the note-segment reader at /notes/<docId>.
  const noteDocHref = buildReaderSourceHref({
    chapterNo: card.chapterNo,
    docId: card.sourceDocId,
    frameId: card.sourceFrameId,
    kind: "flashcard",
  });

  return {
    card,
    chapterMeta,
    relatedCards,
    relatedQuestionCount,
    noteDocHref,
  };
}

// ---------------------------------------------------------------------------
// 5. searchFlashcardsAcrossTaxonomy
// ---------------------------------------------------------------------------

export async function searchFlashcardsAcrossTaxonomy(
  query: string,
  limit = 30,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = await getDb();
  const pattern = `%${escapeLike(trimmed)}%`;

  // Search across front, back, deck, and chapter title
  const rows = await db
    .select({
      id: flashcards.id,
      frontHtml: flashcards.frontHtml,
      backHtml: flashcards.backHtml,
      chapterNo: flashcards.chapterNo,
      chapterTitle: chapters.title,
      deck: flashcards.deck,
    })
    .from(flashcards)
    .leftJoin(chapters, eq(flashcards.chapterNo, chapters.chapterNo))
    .where(
      and(
        ...ACTIVE_CARD_FILTERS,
        or(
          ilike(flashcards.frontHtml, pattern),
          ilike(flashcards.backHtml, pattern),
          ilike(flashcards.deck, pattern),
          ilike(chapters.title, pattern),
        ),
      ),
    )
    .orderBy(desc(flashcards.updatedAt))
    .limit(limit);

  return rows.map((row) => {
    const front = row.frontHtml ?? "";
    const back = row.backHtml ?? "";
    const deck = row.deck ?? "";
    const chTitle = row.chapterTitle ?? "";
    const lowerQuery = trimmed.toLowerCase();

    let matchField: SearchResult["matchField"] = "front";
    if (front.toLowerCase().includes(lowerQuery)) {
      matchField = "front";
    } else if (back.toLowerCase().includes(lowerQuery)) {
      matchField = "back";
    } else if (deck.toLowerCase().includes(lowerQuery)) {
      matchField = "deck";
    } else if (chTitle.toLowerCase().includes(lowerQuery)) {
      matchField = "chapter";
    }

    return {
      id: row.id,
      frontHtml: row.frontHtml,
      backHtml: row.backHtml,
      chapterNo: row.chapterNo,
      chapterTitle: row.chapterTitle ?? null,
      deck: row.deck,
      matchField,
    };
  });
}
