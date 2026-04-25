import { Skeleton } from "@/components/ui/skeleton";

export default function TestLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}