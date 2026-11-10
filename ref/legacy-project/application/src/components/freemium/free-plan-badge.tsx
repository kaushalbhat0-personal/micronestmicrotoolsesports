import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/**
 * FreePlanBadge — marks a tool as having a Free option.
 *
 * Presentational only: no tool name baked in beyond the supplied label,
 * no entitlement lookup, no server calls. Mirrors the existing Free badge
 * language used in billing ("Free plan", `secondary` variant).
 */
export function FreePlanBadge({
  label = "Free plan",
  className,
}: {
  /** Visible badge text. Defaults to "Free plan". */
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(className)}>
      {label}
    </Badge>
  );
}
