import * as React from "react";
import { Card } from "@/components/ui/card";

interface AdminStatCardProps {
  label: string;
  value: number | null;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string | undefined;
}

export function AdminStatCard({ label, value, description, icon: Icon, error }: AdminStatCardProps) {
  const formatted =
    value === null ? null : new Intl.NumberFormat("en-IN").format(value);

  return (
    <Card variant="default" className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground" aria-live="polite">
            {error ? (
              <span className="text-sm font-medium text-destructive">Unavailable</span>
            ) : formatted !== null ? (
              formatted
            ) : (
              "—"
            )}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error ? error : description}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      </div>
    </Card>
  );
}
