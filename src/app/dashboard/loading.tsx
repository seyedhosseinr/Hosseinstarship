import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/80 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_560px]">
          <div>
            <div className="mb-4 flex gap-2">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-40 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-9 w-72 max-w-full" />
            <Skeleton className="mt-3 h-5 w-[520px] max-w-full" />
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:px-8">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className={index === 4 || index === 9 ? "h-72 rounded-2xl lg:col-span-2" : "h-72 rounded-2xl"} />
        ))}
      </div>
    </main>
  );
}
