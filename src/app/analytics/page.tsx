import { FeatureUnavailablePage } from "@/components/runtime/FeatureUnavailablePage";

export default function Page() {
  return (
    <FeatureUnavailablePage
      title="آنالیتیکس کامل هنوز در دسترس نیست"
      description="Dashboard-lite برای context کلی فعال است، اما analytics عمیق هنوز به migration جداگانه نیاز دارد. این صفحه فعلاً غیرفعال شده تا فقط بخش‌های کاملاً Postgres-family در دسترس بمانند."
    />
  );
}
