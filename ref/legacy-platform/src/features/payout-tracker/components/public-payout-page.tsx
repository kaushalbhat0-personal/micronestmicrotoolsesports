import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayoutShareRecord } from "../services/share";
import { calculateTotals, formatMinor } from "../services/totals";
import { deadlineState, formatDeadlineDate, formatMaskedReference, formatPaidDate } from "../services/deadline";
import { DeadlineBadge, RecipientStatusBadge, TrackerStatusBadge } from "./status-badges";

/**
 * Prize Payout Tracker — public renderer (server, no auth).
 * Receives only the allowlisted share record. Renders progress, recipient
 * rows, the required organizer-reported disclaimer, and a MicroNest CTA.
 * Proof links are plain outbound anchors — never fetched, previewed, or framed.
 */
export function PublicPayoutPage({ record }: { record: PayoutShareRecord }) {
  const totals = calculateTotals(record.recipients);
  const state = deadlineState(record.deadline);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          MicroNest · Prize Payout Tracker
        </p>
        <h1 className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">{record.event_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Published by {record.organization_name}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <TrackerStatusBadge status={record.status} />
          {record.deadline ? (
            <span className="text-xs text-muted-foreground">
              Deadline {formatDeadlineDate(record.deadline)} <DeadlineBadge state={state} />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No deadline set</span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Payout progress</CardTitle>
          <CardDescription className="font-mono text-xs">
            {formatMinor(totals.paidMinor, record.currency)} paid · {formatMinor(totals.remainingMinor, record.currency)}{" "}
            remaining · {totals.paidCount} of {totals.totalCount} recipients paid
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={totals.percentPaid}
            aria-label="Payout progress"
            className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${totals.percentPaid}%` }} />
          </div>
          <p className="font-display text-3xl font-normal tabular-nums tracking-tight">{totals.percentPaid}%</p>
          <p className="font-mono text-xs text-muted-foreground">
            {formatMinor(totals.totalMinor, record.currency)} promised · {record.currency}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul aria-label="Payout recipients" className="divide-y divide-border/60">
            {record.recipients.map((r) => (
              <li key={`${r.recipient_name}-${r.amount_minor}`} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.recipient_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {r.status === "paid" && r.paid_at ? <span>Paid {formatPaidDate(r.paid_at)}</span> : null}
                    {r.reference_last4 ? <span className="font-mono">Ref {formatMaskedReference(r.reference_last4)}</span> : null}
                    {r.proof_url ? (
                      <a
                        href={r.proof_url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-primary underline underline-offset-4"
                      >
                        View proof
                      </a>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatMinor(r.amount_minor, record.currency)}
                  </span>
                  <RecipientStatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="rounded-[16px] border border-warning/30 bg-warning-soft/40 p-4 text-sm leading-relaxed" role="note" aria-label="Payout disclaimer">
        <p className="font-semibold">Organizer-reported payout status. Payment information has not been independently verified by MicroNest.</p>
        <p className="mt-2 text-muted-foreground">
          MicroNest does not hold funds, verify payments, or resolve disputes. Contact the event organizer directly with
          questions.
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/tools/prize-payout-tracker"
          className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]"
        >
          Create your own payout tracker
        </Link>
      </div>
    </div>
  );
}
