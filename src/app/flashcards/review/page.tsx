import { FlashcardReviewScreen } from "@/components/flashcard/FlashcardReviewScreen";
import { listManagedDueFlashcards } from "@/lib/services/flashcard-service";

export const dynamic = "force-dynamic";

export default async function FlashcardReviewPage() {
  const cards = await listManagedDueFlashcards(100);
  return <FlashcardReviewScreen initialCards={cards} />;
}
