import * as React from "react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LockSnapshot } from "../types";
import { formatDiff, ruleLabel } from "./rule-labels";
import { formatDateTimeKolkata } from "@/lib/utils/format";

/**
 * Frozen official record. Renders the locked snapshot only — never live state.
 * Print-ready: branding, standings, explanations, record number, timestamp.
 * Neutral header props let the dashboard and the public page share this view.
 */
export function OfficialRecord({
  recordNumber,
  lockedAt,
  snapshot,
  teamNames,
}: {
  recordNumber: string | null;
  lockedAt: string | null;
  snapshot: LockSnapshot;
  teamNames: Readonly<Record<string, string>>;
}) {
  const nameOf = (id: string) => teamNames[id] ?? "Team";
  const lockedLabel = formatDateTimeKolkata(lockedAt);

  return (
    <div className="space-y-6">
      <Card className="print:border-black">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <Lock className="h-3 w-3" aria-hidden /> Official result
            </Badge>
            {recordNumber && (
              <Badge variant="outline" className="font-mono">
                {recordNumber}
              </Badge>
            )}
          </div>
          <CardTitle className="break-words text-2xl">{snapshot.competitionName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {snapshot.organizationName}
            {lockedLabel ? ` · Locked ${lockedLabel}` : ""}
          </p>
          {snapshot.description && <p className="text-sm leading-relaxed">{snapshot.description}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="hidden md:block">
            <Table aria-label="Official standings">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">#</TableHead>
                  <TableHead scope="col">Team</TableHead>
                  <TableHead scope="col">Pts</TableHead>
                  <TableHead scope="col">W</TableHead>
                  <TableHead scope="col">Map ±</TableHead>
                  <TableHead scope="col">Round ±</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.standings.map((entry) => (
                  <TableRow key={`${entry.teamId}-${entry.position}`}>
                    <TableCell className="font-semibold">{entry.position}</TableCell>
                    <TableCell className="break-words font-medium">
                      {nameOf(entry.teamId)}
                      {entry.tied && <span className="ml-2 text-xs font-normal text-muted-foreground">(tied)</span>}
                    </TableCell>
                    <TableCell>{entry.points}</TableCell>
                    <TableCell>{entry.wins}</TableCell>
                    <TableCell>{formatDiff(entry.mapDiff)}</TableCell>
                    <TableCell>{formatDiff(entry.roundDiff)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2 md:hidden" aria-label="Official standings">
            {snapshot.standings.map((entry) => (
              <li key={`${entry.teamId}-${entry.position}`} className="rounded-[12px] border border-border p-3">
                <p className="break-words text-sm font-semibold">
                  {entry.position}. {nameOf(entry.teamId)}
                  {entry.tied && <span className="font-normal text-muted-foreground"> (tied)</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.points} pts · {entry.wins}W · Map {formatDiff(entry.mapDiff)} · Round {formatDiff(entry.roundDiff)}
                </p>
              </li>
            ))}
          </ul>

          <div>
            <h2 className="text-sm font-semibold">Why each team placed here</h2>
            <ul className="mt-2 space-y-2">
              {snapshot.explanations.map((fact, i) => (
                <li key={i} className="rounded-[12px] bg-surface-muted/40 p-3 text-sm leading-relaxed">
                  {fact.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Rules: </span>
              {snapshot.ruleOrder.map((r) => ruleLabel(r)).join(" → ")}
            </p>
            <p>
              <span className="font-semibold text-foreground">Scoring: </span>
              Win {snapshot.scoring.win} · Draw {snapshot.scoring.draw} · Loss {snapshot.scoring.loss}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">This official record is locked and cannot be changed.</p>
        </CardContent>
      </Card>
    </div>
  );
}
