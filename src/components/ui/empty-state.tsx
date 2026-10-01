import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  secondaryAction,
}: {
  className?: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center sm:p-8",
        className
      )}
    >
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
