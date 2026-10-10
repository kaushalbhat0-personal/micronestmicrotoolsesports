"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyDraftActionAction, finalizeDraftMatchAction, resetDraftActionsAction, undoDraftActionAction } from "../actions/match-actions";
import { UpgradeCTA } from "@/components/freemium/upgrade-cta";
import { createState, deriveView } from "../services/draft-engine";
import type { DraftMatch } from "@/types/database";

function teamName(match: DraftMatch, team: "A" | "B"): string {
  return team === "A" ? match.team_a : match.team_b;
}

export function DraftWorkspace({ orgSlug, match }: { orgSlug: string; match: DraftMatch }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [quotaLimited, setQuotaLimited] = React.useState(false);
  const [pendingItem, setPendingItem] = React.useState<string | null>(null);
  const [pendingOp, setPendingOp] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const state = React.useMemo(
    () =>
      createState({
        teamA: match.team_a,
        teamB: match.team_b,
        pool: match.pool,
        sequence: match.sequence,
      }),
    [match.team_a, match.team_b, match.pool, match.sequence],
  );
  const withActions = React.useMemo(
    () => ({ ...state, actions: match.actions.map((a) => ({ ...a })) }),
    [state, match.actions],
  );
  const view = deriveView(withActions);
  const turnName = view.whoseTurn ? teamName(match, view.whoseTurn) : null;
  const turnAnnouncement = view.isComplete
    ? "Draft sequence complete. Review and finalize the record."
    : turnName && view.currentStep
      ? `${turnName} to ${view.currentStep.type}, step ${view.stepIndex + 1} of ${view.totalSteps}.`
      : "Draft ready.";

  async function runOp(fn: () => Promise<{ error?: string; quotaLimited?: boolean }>, itemKey?: string) {
    setError(null);
    setQuotaLimited(false);
    if (itemKey) setPendingItem(itemKey);
    else setPendingOp(true);
    try {
      const result = await fn();
      if (result.error) {
        setError(result.error);
        setQuotaLimited(result.quotaLimited === true);
      } else router.refresh();
    } finally {
      setPendingItem(null);
      setPendingOp(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Step {Math.min(view.stepIndex + 1, view.totalSteps)} of {view.totalSteps} · {match.ref_code}
          </p>
          <p className="break-words text-lg font-semibold">{turnAnnouncement}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={!view.canUndo || pendingOp} onClick={() => runOp(() => undoDraftActionAction({ orgSlug, matchId: match.id, expectedActionCount: match.actions.length }))} aria-label="Undo last action">
            <Undo2 className="h-4 w-4" aria-hidden /> Undo
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={match.actions.length === 0 || pendingOp} onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </Button>
          <Button size="sm" className="min-h-[44px]" disabled={!view.isComplete || pendingOp} onClick={() => runOp(() => finalizeDraftMatchAction({ orgSlug, matchId: match.id }))}>
            <Check className="h-4 w-4" aria-hidden /> Finalize record
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
          {error}
        </p>
      )}
      {quotaLimited && (
        <UpgradeCTA
          href={`/dashboard/${orgSlug}/settings/billing`}
          label="Upgrade for unlimited matches"
          ariaLabel="Upgrade for unlimited official matches"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Available pool</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Draft pool">
              {view.available.map((item) => {
                const taken = item.status !== "available";
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      disabled={taken || view.isComplete || pendingItem !== null || pendingOp}
                      onClick={() =>
                        view.whoseTurn &&
                        runOp(
                          () =>
                            applyDraftActionAction({
                              orgSlug,
                              matchId: match.id,
                              team: view.whoseTurn as "A" | "B",
                              item: item.name,
                              expectedActionCount: match.actions.length,
                            }),
                          item.name,
                        )
                      }
                      aria-disabled={taken}
                      aria-label={taken ? `${item.name}, ${item.status} by team ${item.byTeam}` : `Select ${item.name} for ${turnName}`}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[12px] border border-input bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-border-strong disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate">{item.name}</span>
                      {item.status === "banned" && <Ban className="h-4 w-4 shrink-0 text-destructive" aria-hidden />}
                      {item.status === "picked" && <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          {(["A", "B"] as const).map((team) => (
            <Card key={team}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{teamName(match, team)}</span>
                  <Badge variant={view.whoseTurn === team ? "default" : "secondary"} className="shrink-0">{view.whoseTurn === team ? "To act" : "Waiting"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(team === "A" ? view.teamAItems : view.teamBItems).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No selections yet.</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {(team === "A" ? view.teamAItems : view.teamBItems).map((item, i) => (
                      <li key={`${item.name}-${i}`} className="flex items-center justify-between rounded-[8px] bg-surface-muted/60 px-3 py-2">
                        <span className="truncate font-medium">{item.name}</span>
                        <span className="text-xs capitalize text-muted-foreground">{item.status === "banned" ? "Ban" : "Pick"}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Action history</CardTitle>
        </CardHeader>
        <CardContent>
          {match.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions yet — {teamName(match, "A")} starts.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {match.actions.map((a) => (
                <li key={a.stepIndex} className="flex flex-wrap items-center gap-x-2 rounded-[8px] bg-surface-muted/60 px-3 py-2">
                  <span className="text-muted-foreground">Step {a.stepIndex + 1}</span>
                  <span className="font-medium">{teamName(match, a.team)}</span>
                  <Badge variant={a.type === "ban" ? "destructive" : "success"}>{a.type === "ban" ? "Ban" : "Pick"}</Badge>
                  <span className="font-medium">{a.item}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent onClose={() => setConfirmReset(false)}>
          <DialogHeader>
            <DialogTitle>Reset this draft?</DialogTitle>
            <DialogDescription>All {match.actions.length} recorded actions will be cleared. The teams, pool, and sequence stay the same.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmReset(false)} className="min-h-[44px]">
              Keep actions
            </Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              onClick={async () => {
                setConfirmReset(false);
                await runOp(() => resetDraftActionsAction({ orgSlug, matchId: match.id }));
              }}
            >
              Reset draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
