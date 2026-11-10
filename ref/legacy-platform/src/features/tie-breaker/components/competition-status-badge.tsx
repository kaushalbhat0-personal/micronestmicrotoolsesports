import * as React from "react";
import { Check, Clock3, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "./rule-labels";

const config: Record<"draft" | "active" | "locked", { variant: "secondary" | "warning" | "success" }> = {
  draft: { variant: "secondary" },
  active: { variant: "warning" },
  locked: { variant: "success" },
};

export function CompetitionStatusBadge({ status }: { status: "draft" | "active" | "locked" }) {
  const { variant } = config[status];
  const DisplayIcon = status === "locked" ? Lock : status === "active" ? Check : Clock3;
  return (
    <Badge variant={variant}>
      <DisplayIcon className="h-3 w-3" aria-hidden />
      <span>{statusLabel(status)}</span>
    </Badge>
  );
}
