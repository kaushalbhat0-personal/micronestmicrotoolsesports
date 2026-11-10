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
        <h2 className="flex items-center gap-2 font-display text-[20px] font-normal tracking-[-0.015em] text-foreground">
          {icon ? <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5 sm:pt-1">{action}</div> : null}
    </div>
  );
}
