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
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border bg-surface-muted/40 p-8 text-center sm:p-10",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <h3 className="font-display text-[18px] font-normal tracking-[-0.015em] text-foreground sm:text-[20px]">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">{action}{secondaryAction}</div>
      )}
    </div>
  );
}
