import * as React from "react";
import { Check, X, Clock3, Minus, LoaderCircle, TriangleAlert, CircleCheck, CircleX } from "lucide-react";
import { Badge, type BadgeVariant } from "./badge";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const campaignStatusMap: Record<string, StatusConfig> = {
  draft: { label: "Setup", variant: "secondary", Icon: Clock3 },
  active: { label: "Tracking", variant: "success", Icon: CircleCheck },
  completed: { label: "Completed", variant: "outline", Icon: Check },
  archived: { label: "Archived", variant: "secondary", Icon: Minus },
};

const resultStatusMap: Record<string, StatusConfig> = {
  PASS: { label: "Confirmed", variant: "success", Icon: Check },
  FAIL: { label: "Not found", variant: "destructive", Icon: X },
  NOT_VERIFIABLE: { label: "Needs review", variant: "warning", Icon: TriangleAlert },
  NOT_SUPPORTED: { label: "Not applicable", variant: "outline", Icon: Minus },
  PENDING: { label: "Checking", variant: "secondary", Icon: Clock3 },
};

const scanStatusMap: Record<string, StatusConfig> = {
  pending: { label: "Pending", variant: "secondary", Icon: Clock3 },
  running: { label: "Checking", variant: "warning", Icon: LoaderCircle },
  success: { label: "Confirmed", variant: "success", Icon: CircleCheck },
  partial: { label: "Needs review", variant: "warning", Icon: TriangleAlert },
  failed: { label: "Not found", variant: "destructive", Icon: CircleX },
};

function resolveStatus(status: string): StatusConfig | null {
  if (resultStatusMap[status]) return resultStatusMap[status];
  if (campaignStatusMap[status]) return campaignStatusMap[status];
  if (scanStatusMap[status]) return scanStatusMap[status];
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
  if (!config) {
    return (
      <Badge variant="secondary" className={className} {...props}>
        <Minus className="h-3 w-3" aria-hidden />
        <span>{status}</span>
      </Badge>
    );
  }

  const Icon = config.Icon;
  const isSpinning = status === "running" || status === "PENDING";

  return (
    <Badge variant={config.variant} className={className} aria-label={`${config.label}: ${status}`} {...props}>
      <Icon className={`h-3 w-3 ${isSpinning ? "animate-spin" : ""}`.trim()} aria-hidden />
      <span>{config.label}</span>
    </Badge>
  );
}

export { campaignStatusMap, resultStatusMap, scanStatusMap };
