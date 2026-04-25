import { getFlashcardHierarchyCounts } from "@/lib/flashcards/taxonomy-queries";
import { getFlashcardStatsSnapshot } from "@/lib/flashcards/queries";
import FlashcardLibrary from "@/components/flashcard/FlashcardLibrary";

export const dynamic = "force-dynamic";

export default async function FlashcardLibraryPage() {
  const [hierarchy, stats] = await Promise.all([
    getFlashcardHierarchyCounts(),
    getFlashcardStatsSnapshot(),
  ]);

  return (
    <FlashcardLibrary
      hierarchy={hierarchy}
      totalDue={stats.due}
      totalNew={stats.newCount}
      totalCards={stats.total}
    />
  );
}
