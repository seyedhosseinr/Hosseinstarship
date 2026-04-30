import { FlashcardReviewScreen } from "@/components/flashcard/FlashcardReviewScreen";
import { normalizeChapterKey, filterFlashcardsByChapter } from "@/lib/flashcards/chapter-filter";
import { listManagedDueFlashcards } from "@/lib/services/flashcard-service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ chapter?: string | string[] }>;
};

export default async function FlashcardReviewPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const rawChapter = Array.isArray(params?.chapter) ? params?.chapter[0] : params?.chapter;
  const chapterKey = normalizeChapterKey(rawChapter);
  const chapterNo = chapterKey != null ? Number.parseInt(chapterKey, 10) : undefined;

  const cards = await listManagedDueFlashcards(100, chapterNo);
  // Defense in depth: even though listManagedDueFlashcards already filters
  // by chapterNo at the SQL level, re-filter on the way out so any future
  // loader that forgets the chapter scope cannot leak cross-chapter cards.
  const scoped = filterFlashcardsByChapter(cards, chapterKey);

  return <FlashcardReviewScreen initialCards={scoped} chapter={chapterKey} />;
}
