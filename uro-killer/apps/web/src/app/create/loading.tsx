import { Skeleton } from "@/components/ui/skeleton";

export default function CreateLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[300px] w-full rounded-2xl" />
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}