"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, CircleCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StandingsResult } from "../types";
import { formatDiff, ruleLabel } from "./rule-labels";

/** Plain-language reason for one placement. Always rendered from server facts. */
export function ExplanationSummary({ text }: { text: string }) {
  return <p className="max-w-2xl text-sm leading-relaxed">{text}</p>;
}

/** Server-computed standings, rendered with tie states and plain-language reasons. */
export function StandingsView({
  standings,
  teamNames,
}: {
  standings: StandingsResult;
  teamNames: Readonly<Record<string, string>>;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const nameOf = (id: string) => teamNames[id] ?? "Team";

  if (standings.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No standings yet"
            description="Standings appear here once completed results are recorded."
          />
        </CardContent>
      </Card>
    );
  }

  const explanationFor = (teamId: string) =>
    standings.explanations.find((e) => e.teamIds.includes(teamId));

  function statusCell(teamId: string, decisiveRule: StandingsResult["entries"][number]["decisiveRule"], tied: boolean) {
    if (tied) {
      return (
        <Badge variant="warning">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Still tied
        </Badge>
      );
    }
    if (decisiveRule) {
      return (
        <Badge variant="outline">
          <CircleCheck className="h-3 w-3" aria-hidden /> {`Separated by ${ruleLabel(decisiveRule)}`}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Info className="h-3 w-3" aria-hidden /> Placed on points
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {standings.tieGroups.length > 0 && (
          <div role="status" className="rounded-[12px] border border-warning/30 bg-warning-soft p-3 text-sm">
            <p className="font-semibold">Tie detected — {standings.tieGroups.length === 1 ? "one group remains" : `${standings.tieGroups.length} groups remain`} unresolved.</p>
            {standings.tieGroups.map((group, i) => (
              <p key={i} className="mt-1 leading-relaxed">
                {group.memberIds.map((id) => nameOf(id)).join(", ")}: none of the selected rules separates these
                teams. The official record will show this tie as unresolved.
              </p>
            ))}
          </div>
        )}

        <div aria-live="polite">
          <div className="hidden md:block">
            <Table aria-label="Standings">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">#</TableHead>
                  <TableHead scope="col">Team</TableHead>
                  <TableHead scope="col">Pts</TableHead>
                  <TableHead scope="col">W</TableHead>
                  <TableHead scope="col">Map ±</TableHead>
                  <TableHead scope="col">Round ±</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Explanation</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.entries.map((entry) => {
                  const fact = explanationFor(entry.teamId);
                  const isOpen = expanded === `${entry.teamId}-${entry.position}`;
                  return (
                    <React.Fragment key={`${entry.teamId}-${entry.position}`}>
                      <TableRow>
                        <TableCell className="font-semibold">{entry.position}</TableCell>
                        <TableCell className="max-w-[14rem] break-words font-medium">{nameOf(entry.teamId)}</TableCell>
                        <TableCell>{entry.points}</TableCell>
                        <TableCell>{entry.wins}</TableCell>
                        <TableCell>{formatDiff(entry.mapDiff)}</TableCell>
                        <TableCell>{formatDiff(entry.roundDiff)}</TableCell>
                        <TableCell>{statusCell(entry.teamId, entry.decisiveRule, entry.tied)}</TableCell>
                        <TableCell>
                          {fact && (
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : `${entry.teamId}-${entry.position}`)}
                              aria-expanded={isOpen}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={isOpen ? `Hide why ${nameOf(entry.teamId)} is placed here` : `Show why ${nameOf(entry.teamId)} is placed here`}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                      {fact && isOpen && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-surface-muted/40">
                            <ExplanationSummary text={fact.summary} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden" aria-label="Standings">
            {standings.entries.map((entry) => {
              const fact = explanationFor(entry.teamId);
              const isOpen = expanded === `${entry.teamId}-${entry.position}`;
              return (
                <li
                  key={`${entry.teamId}-${entry.position}`}
                  className={`rounded-[16px] border bg-card p-4 ${entry.tied ? "border-warning/40" : "border-border"}`}
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold">
                      {entry.position}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-semibold">{nameOf(entry.teamId)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.points} pts · {entry.wins}W · Map {formatDiff(entry.mapDiff)} · Round {formatDiff(entry.roundDiff)}
                  </p>
                  <div className="mt-2">{statusCell(entry.teamId, entry.decisiveRule, entry.tied)}</div>
                  {entry.tied && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Order shown is alphabetical for display only — not a ranking.
                    </p>
                  )}
                  {fact && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : `${entry.teamId}-${entry.position}`)}
                        aria-expanded={isOpen}
                        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isOpen ? "Hide why" : "Why this position?"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      {isOpen && (
                        <div className="mt-1">
                          <ExplanationSummary text={fact.summary} />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
