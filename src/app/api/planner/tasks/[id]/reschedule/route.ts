import { featureUnavailable } from "@/app/api/_shared/feature-unavailable";

export async function POST() {
  return featureUnavailable("planner_task_reschedule");
}
