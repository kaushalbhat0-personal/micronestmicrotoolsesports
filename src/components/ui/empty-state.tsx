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
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center sm:p-12",
        className
      )}
    >
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
