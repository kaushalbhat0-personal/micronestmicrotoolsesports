import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[96px] rounded-[12px]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-[96px] rounded-[16px]" />
        <Skeleton className="h-[96px] rounded-[16px]" />
        <Skeleton className="h-[96px] rounded-[16px]" />
      </div>
      <Skeleton className="h-[280px] rounded-[16px]" />
    </div>
  );
}
