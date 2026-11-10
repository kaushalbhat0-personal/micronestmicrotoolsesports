"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { TieBreakerResultRow } from "@/server/repositories/tie-breaker-results";
import type { TieBreakerTeamRow } from "@/server/repositories/tie-breaker-teams";
import { deleteResultAction } from "../actions/result-actions";
import { ResultEntryForm } from "./result-entry-form";

function scoreLine(result: TieBreakerResultRow, roundLabel: string): string | null {
  const parts: string[] = [];
  if (result.maps_a !== null && result.maps_b !== null) parts.push(`Maps ${result.maps_a}–${result.maps_b}`);
  if (result.rounds_a !== null && result.rounds_b !== null) {
    parts.push(`${roundLabel === "games" ? "Games" : "Rounds"} ${result.rounds_a}–${result.rounds_b}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function outcomeLabel(result: TieBreakerResultRow, nameOf: (id: string) => string): string {
  if (!result.is_complete) return "Incomplete";
  if (result.winner === "draw") return "Draw";
  if (result.winner === "team_a") return `${nameOf(result.team_a_id)} won`;
  if (result.winner === "team_b") return `${nameOf(result.team_b_id)} won`;
  return "Incomplete";
}

/** Recorded results with complete/incomplete states and duplicate-pair flags. */
export function ResultList({
  orgSlug,
  competitionId,
  teams,
  results,
  duplicatePairIds,
  roundLabel,
  drawsEnabled,
}: {
  orgSlug: string;
  competitionId: string;
  teams: readonly TieBreakerTeamRow[];
  results: readonly TieBreakerResultRow[];
  duplicatePairIds: readonly string[];
  roundLabel: "rounds" | "games";
  drawsEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<TieBreakerResultRow | null>(null);
  const [deleting, setDeleting] = React.useState<TieBreakerResultRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "Team";
  const incomplete = results.filter((r) => !r.is_complete);

  async function onDelete() {
    if (!deleting) return;
    setError(null);
    setBusy(true);
    try {
      const result = await deleteResultAction({ orgSlug, competitionId, resultId: deleting.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleting(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Results{" "}
          <span className="text-sm font-normal text-muted-foreground" aria-live="polite">
            {results.filter((r) => r.is_complete).length} complete
            {incomplete.length > 0 && ` · ${incomplete.length} incomplete`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
            {error}
          </p>
        )}

        {incomplete.length > 0 && (
          <p role="status" className="rounded-[12px] border border-warning/30 bg-warning-soft p-3 text-sm">
            {incomplete.length} {incomplete.length === 1 ? "result is" : "results are"} incomplete. Incomplete results
            are saved but are not included in the standings — add the missing winner to include{" "}
            {incomplete.length === 1 ? "it" : "them"}.
          </p>
        )}

        {results.length === 0 ? (
          <EmptyState
            title="Enter your first completed result to calculate standings"
            description="Record finished matches above. Standings appear automatically once results exist."
          />
        ) : (
          <ul className="space-y-2" aria-label="Recorded results">
            {results.map((result) => (
              <li
                key={result.id}
                className="flex flex-col gap-2 rounded-[12px] border border-border bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">
                    {nameOf(result.team_a_id)} vs {nameOf(result.team_b_id)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {outcomeLabel(result, nameOf)}
                    {scoreLine(result, roundLabel) ? ` · ${scoreLine(result, roundLabel)}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant={result.is_complete ? "success" : "warning"}>
                      {result.is_complete ? "Complete" : "Incomplete"}
                    </Badge>
                    {duplicatePairIds.includes(result.id) && <Badge variant="outline">Rematch recorded</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => setEditing(result)}
                    aria-label={`Edit result ${nameOf(result.team_a_id)} versus ${nameOf(result.team_b_id)}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] text-destructive"
                    onClick={() => setDeleting(result)}
                    aria-label={`Delete result ${nameOf(result.team_a_id)} versus ${nameOf(result.team_b_id)}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <ResultEntryForm
            orgSlug={orgSlug}
            competitionId={competitionId}
            teams={teams}
            drawsEnabled={drawsEnabled}
            roundLabel={roundLabel}
            editing={editing}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}

        <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this result?</DialogTitle>
              <DialogDescription>This removes the result from the standings. This cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" loading={busy} className="min-h-[44px]" onClick={onDelete}>
                Delete result
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
