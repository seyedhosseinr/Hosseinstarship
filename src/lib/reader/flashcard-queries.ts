import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { flashcards } from "@/db/schema";

export async function listReaderFlashcardsForDoc(docId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: flashcards.id,
      frontHtml: flashcards.frontHtml,
      fsrsDue: flashcards.fsrsDue,
    })
    .from(flashcards)
    .where(and(eq(flashcards.sourceDocId, docId), eq(flashcards.isArchived, 0)))
    .orderBy(desc(flashcards.updatedAt))
    .limit(8);

  return rows.map((card) => ({
    id: card.id,
    frontHtml: card.frontHtml,
    dueAt: card.fsrsDue,
  }));
}
