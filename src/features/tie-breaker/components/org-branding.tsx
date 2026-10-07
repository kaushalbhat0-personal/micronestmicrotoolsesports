import * as React from "react";
import { cn } from "@/lib/utils/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/**
 * Tie-Breaker Resolver — Organization branding mark.
 * Renders the locked snapshot logo (https only) or initials fallback.
 * Never exposes internal organization identifiers.
 */
export function OrgBadge({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl?: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";
  if (logoUrl && logoUrl.startsWith("https://")) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn("rounded-full border border-border bg-card object-cover", dims, className)}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-surface-warm font-semibold text-foreground",
        dims,
        className,
      )}
      aria-label={`${name} initials`}
      role="img"
    >
      {initials(name)}
    </span>
  );
}
