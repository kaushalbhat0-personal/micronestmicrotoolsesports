import * as React from "react";
import { Badge, type BadgeVariant } from "./badge";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  icon: string;
};

// Campaign status: internal enum stays, presentation is user-facing
const campaignStatusMap: Record<string, StatusConfig> = {
  draft: { label: "Setup", variant: "secondary", icon: "◌" },
  active: { label: "Tracking", variant: "success", icon: "●" },
  completed: { label: "Completed", variant: "outline", icon: "✓" },
  archived: { label: "Archived", variant: "secondary", icon: "—" },
};

// Check / result status
const resultStatusMap: Record<string, StatusConfig> = {
  PASS: { label: "Confirmed", variant: "success", icon: "✓" },
  FAIL: { label: "Not found", variant: "destructive", icon: "×" },
  NOT_VERIFIABLE: { label: "Needs review", variant: "warning", icon: "◐" },
  NOT_SUPPORTED: { label: "Not applicable", variant: "outline", icon: "—" },
  PENDING: { label: "Checking", variant: "secondary", icon: "◌" },
};

// Scan status (existing, keep for backward compat)
const scanStatusMap: Record<string, StatusConfig> = {
  pending: { label: "Pending", variant: "secondary", icon: "◌" },
  running: { label: "Checking", variant: "warning", icon: "◌" },
  success: { label: "Confirmed", variant: "success", icon: "✓" },
  partial: { label: "Needs review", variant: "warning", icon: "◐" },
  failed: { label: "Not found", variant: "destructive", icon: "×" },
};

function resolveStatus(status: string): StatusConfig | null {
  // Exact match priority: result (uppercase) → campaign → scan
  if (resultStatusMap[status]) return resultStatusMap[status];
  if (campaignStatusMap[status]) return campaignStatusMap[status];
  if (scanStatusMap[status]) return scanStatusMap[status];
  // Case-insensitive fallback for campaign
  const lower = status.toLowerCase();
  if (campaignStatusMap[lower]) return campaignStatusMap[lower];
  if (scanStatusMap[lower]) return scanStatusMap[lower];
  return null;
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = resolveStatus(status);
  // Fallback: render raw status with secondary variant, still icon+text for a11y
  if (!config) {
    return (
      <Badge variant="secondary" className={className} {...props}>
        <span aria-hidden>—</span>
        <span>{status}</span>
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} className={className} aria-label={`${config.label}: ${status}`} {...props}>
      <span aria-hidden className="leading-none">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </Badge>
  );
}

// Re-export for explicit type usage if needed
export { campaignStatusMap, resultStatusMap, scanStatusMap };
