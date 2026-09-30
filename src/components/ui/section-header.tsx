import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function SectionHeader({ title, description, action, icon, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)} {...props}>
      <div className="min-w-0 space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-1 sm:pt-0">{action}</div> : null}
    </div>
  );
}
