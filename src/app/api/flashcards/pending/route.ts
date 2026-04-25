import { featureUnavailable } from "@/app/api/_shared/feature-unavailable";

export async function GET() {
  return featureUnavailable("flashcards_pending");
}

export async function POST() {
  return featureUnavailable("flashcards_pending");
}

export async function DELETE() {
  return featureUnavailable("flashcards_pending");
}
