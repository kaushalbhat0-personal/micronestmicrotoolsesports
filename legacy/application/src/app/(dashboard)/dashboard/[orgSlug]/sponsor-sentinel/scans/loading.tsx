import { Skeleton } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[320px] rounded-[16px]" />
    </div>
  );
}
