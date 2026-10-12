import { Badge } from "@/components/ui/badge";
import { Check, Clock3, FileEdit, Globe } from "lucide-react";
import type { DeadlineState } from "../services/deadline";
import type { PayoutRecipientStatus, PayoutTrackerStatus } from "../types";

/** Shared status badges — dashboard list, detail, and public page stay consistent. */

export function TrackerStatusBadge({ status }: { status: PayoutTrackerStatus }) {
  if (status === "completed") {
    return (
      <Badge variant="success">
        <Check className="h-3 w-3" aria-hidden />
        <span>Completed</span>
      </Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge variant="info">
        <Globe className="h-3 w-3" aria-hidden />
        <span>Published</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <FileEdit className="h-3 w-3" aria-hidden />
      <span>Draft</span>
    </Badge>
  );
}

export function RecipientStatusBadge({ status }: { status: PayoutRecipientStatus }) {
  if (status === "paid") {
    return (
      <Badge variant="success">
        <Check className="h-3 w-3" aria-hidden />
        <span>Paid</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Clock3 className="h-3 w-3" aria-hidden />
      <span>Pending</span>
    </Badge>
  );
}

const DEADLINE_LABEL: Record<Exclude<DeadlineState, "none">, string> = {
  upcoming: "Upcoming",
  "due-today": "Due today",
  overdue: "Overdue",
};

export function DeadlineBadge({ state }: { state: DeadlineState }) {
  if (state === "none") return null;
  const variant = state === "overdue" ? "warning" : state === "due-today" ? "info" : "secondary";
  return <Badge variant={variant}>{DEADLINE_LABEL[state]}</Badge>;
}
