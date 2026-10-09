import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * FreeUsageLine — "N of M <unit>" usage readout for a Free tier.
 *
 * Presentational only: `used`, `limit`, and the unit noun come from the
 * caller (usually server-computed usage). Assumes no particular tool or
 * unit — "official records", "official results", "checks", anything.
 */
export function FreeUsageLine({
  used,
  limit,
  label,
  className,
}: {
  /** Current usage count (server-computed). */
  used: number;
  /** Free allowance for the same unit and period. */
  limit: number;
  /** Unit noun supplied by the caller, e.g. "official records". */
  label: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} role="status">
      {used} of {limit} {label} in use
    </p>
  );
}
