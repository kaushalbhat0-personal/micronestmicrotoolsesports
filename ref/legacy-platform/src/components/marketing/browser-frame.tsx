import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * BrowserFrame — editorial product screenshot frame.
 * Rounded 16, thin border, white surface, restrained shadow, muted dot row.
 * Accepts arbitrary children (screenshots, UI fragments).
 * Warm mat should be provided by the parent if desired (e.g., bg-surface-muted/40 p-4).
 */
export function BrowserFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[16px] border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/60 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-border" aria-hidden />
      </div>
      <div className="bg-card">{children}</div>
    </div>
  );
}
