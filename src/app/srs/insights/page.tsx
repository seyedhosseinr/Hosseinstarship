import { FeatureUnavailablePage } from "@/components/runtime/FeatureUnavailablePage";

export default function SRSInsightsPage() {
  return (
    <FeatureUnavailablePage
      title="SRS Insights هنوز migrate نشده است"
      description="بینش‌های کامل SRS هنوز به queryها و aggregationهای legacy متکی هستند. این صفحه فعلاً غیرفعال شده تا از خطای runtime و data inconsistency جلوگیری شود."
    />
  );
}
