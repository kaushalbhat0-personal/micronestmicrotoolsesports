"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lockCompetitionAction } from "../actions/competition-actions";
import { UpgradeCTA } from "@/components/freemium/upgrade-cta";

/** Irreversible lock with explicit acknowledgments. The server stays authoritative. */
export function LockDialog({
  orgSlug,
  competitionId,
  incompleteCount,
  unresolvedCount,
  canLock,
  blockers,
}: {
  orgSlug: string;
  competitionId: string;
  incompleteCount: number;
  unresolvedCount: number;
  canLock: boolean;
  blockers: readonly string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [ackIncomplete, setAckIncomplete] = React.useState(false);
  const [ackUnresolved, setAckUnresolved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quotaLimited, setQuotaLimited] = React.useState(false);
  const [locking, setLocking] = React.useState(false);

  const ready = canLock && (incompleteCount === 0 || ackIncomplete) && (unresolvedCount === 0 || ackUnresolved);

  async function onLock() {
    setError(null);
    setQuotaLimited(false);
    setLocking(true);
    try {
      const result = await lockCompetitionAction({
        orgSlug,
        competitionId,
        allowIncomplete: ackIncomplete,
        allowUnresolved: ackUnresolved,
      });
      if (result.error) {
        setError(result.error);
        setQuotaLimited(result.quotaLimited === true);
        return;
      }
      setOpen(false);
      router.push(`/dashboard/${orgSlug}/tie-breaker/${competitionId}` as Route);
      router.refresh();
    } finally {
      setLocking(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        disabled={!canLock}
        className="min-h-[44px]"
          onClick={() => {
            setAckIncomplete(false);
            setAckUnresolved(false);
            setError(null);
            setQuotaLimited(false);
            setOpen(true);
          }}
      >
        <Lock className="h-4 w-4" aria-hidden /> Finish and lock
      </Button>
      {!canLock && blockers.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground" aria-label="What is needed before locking">
          {blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish and lock this result?</DialogTitle>
            <DialogDescription>
              Locking creates the official record. The result cannot be edited afterward. If something is wrong
              later, copy this competition for the next event and issue a new official record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {error && (
              <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
                {error}
              </p>
            )}
            {quotaLimited && (
              <UpgradeCTA
                href={`/dashboard/${orgSlug}/settings/billing`}
                label="Upgrade for unlimited records"
                ariaLabel="Upgrade for unlimited official records"
              />
            )}
            {incompleteCount > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={ackIncomplete}
                  onChange={(e) => setAckIncomplete(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="leading-relaxed">
                  {incompleteCount} {incompleteCount === 1 ? "result is" : "results are"} incomplete.{" "}
                  {incompleteCount === 1 ? "It" : "They"} will not be included in the standings. I understand and
                  want to lock the official result.
                </span>
              </label>
            )}
            {unresolvedCount > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={ackUnresolved}
                  onChange={(e) => setAckUnresolved(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="leading-relaxed">
                  Some teams remain tied under the selected rules. The official record will show these ties as
                  unresolved.
                </span>
              </label>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" loading={locking} disabled={!ready} className="min-h-[44px]" onClick={onLock}>
                <Lock className="h-4 w-4" aria-hidden /> Lock official result
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
