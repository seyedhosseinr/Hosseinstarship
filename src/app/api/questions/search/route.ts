import { featureUnavailable } from "@/app/api/_shared/feature-unavailable";

export async function GET() {
  return featureUnavailable("questions_search");
}
