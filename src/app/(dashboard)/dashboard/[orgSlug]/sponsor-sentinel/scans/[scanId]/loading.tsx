import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[140px] rounded-[16px]" />
      <Skeleton className="h-[240px] rounded-[16px]" />
    </div>
  );
}
