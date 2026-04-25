import { FeatureUnavailablePage } from "@/components/runtime/FeatureUnavailablePage";

export default function Page() {
  return (
    <FeatureUnavailablePage
      title="Space در این نسخه فعال نیست"
      description="Space هنوز بخشی از برش deployable فعلی نیست. این مسیر عمداً غیرفعال شده تا scope روشن بماند و app shell فقط featureهای واقعی و پایدار را نشان دهد."
    />
  );
}
