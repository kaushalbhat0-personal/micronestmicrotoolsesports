import { cn } from "@/lib/utils/cn";

export function LoadingState({ className, message = "Loading…" }: { className?: string; message?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 p-8", className)} role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
