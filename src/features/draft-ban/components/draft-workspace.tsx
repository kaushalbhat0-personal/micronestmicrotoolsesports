"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [sideInput, setSideInput] = React.useState("");

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
  const isSideStep = !view.isComplete && view.currentStep?.type === "side";
  const turnVerb = view.currentStep?.type === "side" ? "to choose side" : view.currentStep ? `to ${view.currentStep.type}` : null;
  const turnAnnouncement = view.isComplete
    ? "Draft sequence complete. Review and finalize the record."
    : turnName && turnVerb
      ? `${turnName} ${turnVerb}, step ${view.stepIndex + 1} of ${view.totalSteps}.`
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
            {isSideStep && (
              <p className="mb-3 text-sm text-muted-foreground">
                Side step — record {turnName}&apos;s side choice below. Pool picks are paused for this step.
              </p>
            )}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Draft pool">
              {view.available.map((item) => {
                const taken = item.status !== "available";
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      disabled={taken || view.isComplete || isSideStep || pendingItem !== null || pendingOp}
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

        {isSideStep && view.whoseTurn && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Record side choice</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = sideInput.trim();
                  if (!value || !view.whoseTurn) return;
                  const team = view.whoseTurn;
                  setSideInput("");
                  void runOp(
                    () =>
                      applyDraftActionAction({
                        orgSlug,
                        matchId: match.id,
                        team,
                        item: value,
                        expectedActionCount: match.actions.length,
                      }),
                    `side-${match.actions.length}`,
                  );
                }}
              >
                <div className="flex-1 space-y-2">
                  <Label htmlFor="side-choice">Side for {turnName}</Label>
                  <Input
                    id="side-choice"
                    value={sideInput}
                    onChange={(e) => setSideInput(e.target.value)}
                    placeholder="e.g. CT, Attack, Defense"
                    maxLength={60}
                    disabled={pendingOp || pendingItem !== null}
                    className="font-mono"
                  />
                </div>
                <Button type="submit" className="min-h-[44px] sm:self-end" disabled={!sideInput.trim() || pendingOp || pendingItem !== null}>
                  <Check className="h-4 w-4" aria-hidden /> Record side
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">Free text — any side label both teams agree on. Sides never consume pool items.</p>
            </CardContent>
          </Card>
        )}

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
                        <span className="text-xs capitalize text-muted-foreground">{item.status === "banned" ? "Ban" : item.status === "picked" ? "Pick" : "Side"}</span>
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
                  <Badge variant={a.type === "ban" ? "destructive" : a.type === "pick" ? "success" : "secondary"}>{a.type === "ban" ? "Ban" : a.type === "pick" ? "Pick" : "Side"}</Badge>
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
