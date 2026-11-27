import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[72px] rounded-[12px]" />
      <Skeleton className="h-[180px] rounded-[16px]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[120px] rounded-[16px]" />
        <Skeleton className="h-[120px] rounded-[16px]" />
        <Skeleton className="h-[120px] rounded-[16px]" />
      </div>
    </div>
  );
}
