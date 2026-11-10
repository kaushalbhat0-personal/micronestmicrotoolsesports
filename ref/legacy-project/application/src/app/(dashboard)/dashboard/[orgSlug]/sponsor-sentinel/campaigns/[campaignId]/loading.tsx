import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[120px] rounded-[16px]" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[100px] rounded-[16px]" />
        <Skeleton className="h-[100px] rounded-[16px]" />
      </div>
      <Skeleton className="h-[120px] rounded-[16px]" />
      <Skeleton className="h-[200px] rounded-[16px]" />
    </div>
  );
}
