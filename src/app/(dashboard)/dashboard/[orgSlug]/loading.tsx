import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-[110px] rounded-[16px]" />
        <Skeleton className="h-[110px] rounded-[16px]" />
        <Skeleton className="h-[110px] rounded-[16px]" />
      </div>
      <Skeleton className="h-[160px] rounded-[16px]" />
      <Skeleton className="h-[240px] rounded-[16px]" />
      <Skeleton className="h-[180px] rounded-[16px]" />
    </div>
  );
}
