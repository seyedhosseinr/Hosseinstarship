import { FeatureUnavailablePage } from "@/components/runtime/FeatureUnavailablePage";

export default function Page() {
  return (
    <FeatureUnavailablePage
      title="آزمون‌ساز هنوز برای runtime جدید آماده نیست"
      description="مسیر ساخت آزمون هنوز به flowهای قدیمی exam و client-side state متکی است. این بخش فعلاً غیرفعال شده تا تجربه‌ی اصلی Library، Reader و app shell روی PGlite + OPFS پایدار بماند."
    />
  );
}
