import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardHeader, CardTitle, CardContent } from "./card";
import { Badge } from "./badge";

export type ReadinessItemStatus = "complete" | "warning" | "blocked";

export interface ReadinessItem {
  label: string;
  status: ReadinessItemStatus;
  description?: string;
}

export interface ReadinessCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  items: ReadinessItem[];
  action?: React.ReactNode;
}

function itemIcon(status: ReadinessItemStatus) {
  switch (status) {
    case "complete":
      return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] leading-none text-success-foreground">✓</span>;
    case "warning":
      return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[10px] leading-none text-warning-foreground">⚠</span>;
    case "blocked":
      return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] leading-none text-destructive-foreground">×</span>;
  }
}

function isReady(items: ReadinessItem[]) {
  return items.every((i) => i.status === "complete");
}

export function ReadinessCard({ title, description, items, action, className, ...props }: ReadinessCardProps) {
  const ready = isReady(items);
  const completedCount = items.filter((i) => i.status === "complete").length;

  return (
    <Card
      className={cn(
        "overflow-hidden",
        ready ? "border-success/20 bg-success-soft" : "border-warning/20 bg-warning-soft",
        className
      )}
      {...props}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", ready ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground")}>
                {ready ? "✓" : "!"}
              </span>
              {title}
            </CardTitle>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">{`${completedCount} of ${items.length} ready`}</p>
          </div>
          {ready ? <Badge variant="success">Ready</Badge> : <Badge variant="warning">Needs setup</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              {itemIcon(item.status)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none">{item.label}</p>
                {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{item.status === "complete" ? "✓" : item.status === "warning" ? "⚠" : "—"}</span>
            </li>
          ))}
        </ul>
        {action ? <div className="pt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
