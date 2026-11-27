import * as React from "react";
import { StatusBadge } from "@/components/ui/status-badge";

// Backward compat: delegates to shared StatusBadge mapping
export function ScanStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
