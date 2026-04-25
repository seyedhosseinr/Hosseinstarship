import { featureUnavailable } from "@/app/api/_shared/feature-unavailable";

export async function POST() {
  return featureUnavailable("questions_reset");
}
