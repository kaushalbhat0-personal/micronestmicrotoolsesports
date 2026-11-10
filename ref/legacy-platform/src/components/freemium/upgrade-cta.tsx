import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils/cn";

/**
 * UpgradeCTA — consistent upgrade action from a Free limitation.
 *
 * Presentational only: destination and copy come from the caller. Performs
 * no mutation, creates no checkout, embeds no pricing or tool names, and
 * makes no authorization decision. Same pill treatment as existing upgrade
 * links (44px minimum touch target, visible focus ring from base styles).
 */
export function UpgradeCTA({
  href,
  label,
  ariaLabel,
  className,
}: {
  /** Destination supplied by the caller (e.g. workspace settings route). */
  href: string;
  /** Visible link text supplied by the caller. */
  label: string;
  /** Accessible label; defaults to the visible label. */
  ariaLabel?: string | undefined;
  className?: string;
}) {
  return (
    <Link
      href={href as Route}
      aria-label={ariaLabel ?? label}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {label}
    </Link>
  );
}
