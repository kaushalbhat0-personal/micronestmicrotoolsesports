import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RuleId, StandingsResult } from "../types";
import { ruleLabel } from "./rule-labels";

export interface ReviewSummary {
  teamCount: number;
  completeCount: number;
  incompleteCount: number;
  ruleOrder: readonly RuleId[];
  scoringLine: string;
  standings: StandingsResult;
  teamNames: Readonly<Record<string, string>>;
}

/** Pre-lock review from actual server state. Nothing here is invented. */
export function ReviewChecklist({ summary }: { summary: ReviewSummary }) {
  const nameOf = (id: string) => summary.teamNames[id] ?? "Team";
  const rows: { ok: boolean; text: string }[] = [
    { ok: summary.teamCount >= 2, text: `${summary.teamCount} ${summary.teamCount === 1 ? "team" : "teams"} (need at least 2)` },
    { ok: summary.completeCount >= 1, text: `${summary.completeCount} completed ${summary.completeCount === 1 ? "result" : "results"} (need at least 1)` },
    { ok: summary.ruleOrder.length >= 2, text: `${summary.ruleOrder.length} ranking rules configured` },
    {
      ok: summary.incompleteCount === 0,
      text:
        summary.incompleteCount === 0
          ? "No incomplete results"
          : `${summary.incompleteCount} incomplete ${summary.incompleteCount === 1 ? "result" : "results"} — will not be counted unless acknowledged`,
    },
    {
      ok: summary.standings.tieGroups.length === 0,
      text:
        summary.standings.tieGroups.length === 0
          ? "No unresolved ties"
          : `${summary.standings.tieGroups.length} unresolved ${summary.standings.tieGroups.length === 1 ? "tie" : "ties"} — ${summary.standings.tieGroups
              .map((g) => g.memberIds.map((id) => nameOf(id)).join(", "))
              .join("; ")}`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review before locking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2" aria-label="Lock readiness checklist">
          {rows.map((row) => (
            <li key={row.text} className="flex items-start gap-2 text-sm">
              {row.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Ready" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Needs attention" />
              )}
              <span className="leading-relaxed">{row.text}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Rules: </span>
            {summary.ruleOrder.map((r) => ruleLabel(r)).join(" → ")}
          </p>
          <p>
            <span className="font-semibold">Scoring: </span>
            {summary.scoringLine}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
