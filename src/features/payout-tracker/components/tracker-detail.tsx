"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateTotals, formatMinor } from "../services/totals";
import { deadlineState, formatDeadlineDate } from "../services/deadline";
import {
  deleteTrackerAction,
  publishTrackerAction,
  revokeShareLinkAction,
  updateTrackerAction,
} from "../actions/tracker-actions";
import type { TrackerDetail as TrackerDetailData } from "../services/tracker-service";
import { DeadlineBadge, TrackerStatusBadge } from "./status-badges";
import { PayoutShareLinkButton } from "./share-link-button";
import { PayoutWhatsAppShare } from "./whatsapp-share";
import { RecipientManager } from "./recipient-manager";

/**
 * Prize Payout Tracker — detail workspace (client).
 * Summary + event editing + publish/revoke/delete + recipient manager.
 * Currency is fixed after creation so published amounts never reinterpret.
 */
export function TrackerDetail({
  orgSlug,
  detail,
  recipientCap,
}: {
  orgSlug: string;
  detail: TrackerDetailData;
  recipientCap: number;
}) {
  const router = useRouter();
  const { tracker, recipients } = detail;
  const totals = calculateTotals(recipients);
  const state = deadlineState(tracker.deadline);

  const [eventName, setEventName] = React.useState(tracker.event_name);
  const [deadline, setDeadline] = React.useState(tracker.deadline ? tracker.deadline.slice(0, 10) : "");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const isDraft = tracker.status === "draft";
  const isLive = tracker.status === "published" || tracker.status === "completed";

  async function run(key: string, fn: () => Promise<{ error?: string; quotaLimited?: boolean }>) {
    setError(null);
    setNotice(null);
    setBusy(key);
    try {
      const res = await fn();
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    await run("meta", () =>
      updateTrackerAction({
        orgSlug,
        trackerId: tracker.id,
        eventName: eventName.trim(),
        deadline: deadline === "" ? undefined : deadline,
      }).then((res) => {
        if (!res.error) setNotice("Event details saved.");
        return res;
      }),
    );
  }

  async function onPublish() {
    await run("publish", () =>
      publishTrackerAction({ orgSlug, trackerId: tracker.id }).then((res) => {
        if (!res.error) setNotice("Published. Share the public link below.");
        return res;
      }),
    );
  }

  async function onRevoke() {
    if (!window.confirm("Revoke this public link? The old URL will stop working immediately.")) return;
    await run("revoke", () =>
      revokeShareLinkAction({ orgSlug, trackerId: tracker.id }).then((res) => {
        if (!res.error) setNotice("Link revoked. A new public URL was generated — copy it below.");
        return res;
      }),
    );
  }

  async function onDelete() {
    if (!window.confirm(`Delete “${tracker.event_name}”? Recipients and the public page go with it. This cannot be undone.`)) return;
    setError(null);
    setBusy("delete");
    try {
      const res = await deleteTrackerAction({ orgSlug, trackerId: tracker.id });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push((`/dashboard/${orgSlug}/payout-tracker`) as Route);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{tracker.event_name}</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {formatMinor(totals.paidMinor, tracker.currency)} paid of {formatMinor(totals.totalMinor, tracker.currency)} ·{" "}
                {totals.paidCount}/{totals.totalCount} recipients
              </CardDescription>
            </div>
            <TrackerStatusBadge status={tracker.status} />
          </div>
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
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${totals.percentPaid}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            {totals.percentPaid}% paid · {formatMinor(totals.remainingMinor, tracker.currency)} remaining
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {tracker.deadline ? (
              <span>
                Deadline {formatDeadlineDate(tracker.deadline)} <DeadlineBadge state={state} />
              </span>
            ) : (
              <span>No deadline set</span>
            )}
            {tracker.status === "completed" ? <span>· All recipients marked paid</span> : null}
          </p>
          {isLive ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-surface-muted/40 p-3">
              <PayoutShareLinkButton shareToken={tracker.share_token} />
              <Button type="button" variant="ghost" size="sm" disabled={busy === "revoke"} loading={busy === "revoke"} onClick={onRevoke} className="min-h-[44px]">
                Revoke link
              </Button>
              <span className="text-xs text-muted-foreground">Revoking invalidates the old URL immediately.</span>
            </div>
          ) : null}
          {isLive ? (
            <PayoutWhatsAppShare eventName={tracker.event_name} status={tracker.status === "completed" ? "completed" : "published"} shareToken={tracker.share_token} />
          ) : null}
          {isDraft ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={busy === "publish" || recipients.length === 0} loading={busy === "publish"} onClick={onPublish} className="min-h-[44px]">
                Publish public page
              </Button>
              {recipients.length === 0 ? (
                <span className="text-xs text-muted-foreground">Add at least one recipient before publishing.</span>
              ) : (
                <span className="text-xs text-muted-foreground">Publishing opens the public payout page.</span>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event details</CardTitle>
          <CardDescription>Currency is fixed at creation ({tracker.currency}).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveMeta} className="grid gap-3 sm:grid-cols-2" aria-label="Edit event details">
            <div className="grid gap-1.5">
              <Label htmlFor="detail-event-name">Event / tournament name</Label>
              <Input id="detail-event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={80} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="detail-deadline">Payout deadline (optional)</Label>
              <Input id="detail-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" size="sm" disabled={busy === "meta"} loading={busy === "meta"} className="min-h-[44px]">
                Save event details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <RecipientManager
        orgSlug={orgSlug}
        trackerId={tracker.id}
        trackerStatus={tracker.status}
        currency={tracker.currency}
        initialRecipients={recipients}
        recipientCap={recipientCap}
      />

      {notice ? (
        <p role="status" className="text-sm text-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base">Danger zone</CardTitle>
          <CardDescription>Deleting removes recipients and invalidates the public page. Monthly publish quota stays consumed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" size="sm" disabled={busy === "delete"} loading={busy === "delete"} onClick={onDelete} className="min-h-[44px]">
            Delete tracker
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
