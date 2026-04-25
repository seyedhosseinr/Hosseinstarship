import { getManagedFlashcardStats, listManagedFlashcards } from "@/lib/services/flashcard-service";
import { FlashcardHub } from "@/components/flashcard/FlashcardHub";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function FlashcardsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const query  = params?.q?.trim() ?? "";

  const [stats, cards] = await Promise.all([
    getManagedFlashcardStats(),
    listManagedFlashcards({ search: query, limit: 96 }),
  ]);

  return <FlashcardHub stats={stats} cards={cards} query={query} />;
}
