import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deadlineState, formatDeadlineDate } from "../services/deadline";
import { formatMinor } from "../services/totals";
import type { TrackerSummary } from "../services/tracker-service";
import { DeadlineBadge, TrackerStatusBadge } from "./status-badges";

/**
 * Prize Payout Tracker — workspace list (presentational, server-safe).
 * Each row links to the tracker detail. No charts, no analytics.
 */
export function TrackerList({ orgSlug, summaries }: { orgSlug: string; summaries: TrackerSummary[] }) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        title="No payout trackers yet"
        description="Create your first tracker, add who should be paid, then publish one public payout page."
      />
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label="Payout trackers">
      {summaries.map(({ tracker, paidCount, totalCount, totalMinor, paidMinor }) => {
        const state = deadlineState(tracker.deadline);
        const href = `/dashboard/${orgSlug}/payout-tracker/${tracker.id}` as Route;
        return (
          <li key={tracker.id}>
            <Link
              href={href}
              className="block rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-border-strong">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{tracker.event_name}</CardTitle>
                    <TrackerStatusBadge status={tracker.status} />
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {paidCount}/{totalCount} paid · {formatMinor(paidMinor, tracker.currency)} of{" "}
                    {formatMinor(totalMinor, tracker.currency)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {tracker.deadline ? (
                    <span>
                      Due {formatDeadlineDate(tracker.deadline)} <DeadlineBadge state={state} />
                    </span>
                  ) : (
                    <span>No deadline</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
