import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-[140px] rounded-[16px]" />
        <Skeleton className="h-[140px] rounded-[16px]" />
        <Skeleton className="h-[140px] rounded-[16px]" />
        <Skeleton className="h-[140px] rounded-[16px]" />
      </div>
    </div>
  );
}
