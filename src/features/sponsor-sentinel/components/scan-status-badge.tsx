import * as React from "react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const variantMap: Record<string, BadgeVariant> = {
  pending: "secondary",
  running: "warning",
  success: "success",
  partial: "warning",
  failed: "destructive",
};

export function ScanStatusBadge({ status }: { status: string }) {
  const variant = variantMap[status] ?? "secondary";
  return (
    <Badge variant={variant} aria-label={`Status ${status}`}>
      {status}
    </Badge>
  );
}
