"use client";

import * as React from "react";
import { type Delimiter, type ParsedRow, type RemovedTeam, type WorkingTeam } from "../types";
import { detectConflicts, summarizeIssues } from "../services/conflicts";
import { buildCopyText, buildCsv, buildPrintModel } from "../services/output";
import {
  addTeam,
  buildWorkingModel,
  movePlayerDown,
  movePlayerUp,
  moveTeamDown,
  moveTeamUp,
  removeTeam,
} from "../services/slots";
import { RosterSummary } from "./roster-summary";
import { RosterIssues } from "./roster-issues";
import { RosterTeamList } from "./roster-team-list";
import { RosterOutput } from "./roster-output";

/**
 * Editable working session for one parse. Remounted (fresh teams) whenever
 * the source text or delimiter changes; capacity changes re-evaluate
 * issues without disturbing team order.
 *
 * Removing a team drops its registrations from the active set (issues and
 * outputs recompute) while the quarantine area keeps every player
 * restorable. Nothing is merged, renamed, or deleted silently.
 */
export function RosterSession({
  rows,
  teamCapacity,
  delimiter,
  delimiterDetected,
  onReset,
}: {
  rows: ReadonlyArray<ParsedRow>;
  teamCapacity: number;
  delimiter: Delimiter;
  delimiterDetected: boolean;
  onReset: () => void;
}) {
  const [teams, setTeams] = React.useState<ReadonlyArray<WorkingTeam>>(() => buildWorkingModel(rows).teams);
  const [removed, setRemoved] = React.useState<ReadonlyArray<RemovedTeam>>([]);

  const removedRowIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const entry of removed) for (const player of entry.players) ids.add(player.rowId);
    return ids;
  }, [removed]);

  const activeRows = React.useMemo(
    () => rows.filter((row) => !removedRowIds.has(row.id)),
    [rows, removedRowIds],
  );

  const issues = React.useMemo(() => detectConflicts(activeRows, { teamCapacity }), [activeRows, teamCapacity]);
  const summary = React.useMemo(() => summarizeIssues(issues), [issues]);
  const blockingCount = React.useMemo(() => issues.filter((issue) => issue.severity === "blocking").length, [issues]);

  const copyText = React.useMemo(() => buildCopyText(teams, { unresolvedCount: blockingCount }), [teams, blockingCount]);
  const csvText = React.useMemo(() => buildCsv(teams), [teams]);
  const printModel = React.useMemo(() => buildPrintModel(teams), [teams]);

  function handleRemoveTeam(teamKey: string) {
    const result = removeTeam(teams, teamKey);
    if (!result.removed) return;
    setTeams(result.teams);
    setRemoved((previous) => [...previous.filter((entry) => entry.teamKey !== teamKey), result.removed as RemovedTeam]);
  }

  function handleRestoreTeam(teamKey: string) {
    const entry = removed.find((candidate) => candidate.teamKey === teamKey);
    if (!entry) return;
    setRemoved((previous) => previous.filter((candidate) => candidate.teamKey !== teamKey));
    setTeams((previous) => [...previous, { teamKey: entry.teamKey, teamDisplay: entry.teamDisplay, players: entry.players }]);
  }

  return (
    <div className="space-y-6">
      <RosterSummary
        stats={{ dataRows: activeRows.length, teams: teams.length, players: countPlayers(teams) }}
        delimiter={delimiter}
        delimiterDetected={delimiterDetected}
        summary={summary}
      />
      <RosterIssues issues={issues} />
      <RosterTeamList
        teams={teams}
        removed={removed}
        capacity={teamCapacity}
        onMoveTeamUp={(key) => setTeams((previous) => moveTeamUp(previous, key))}
        onMoveTeamDown={(key) => setTeams((previous) => moveTeamDown(previous, key))}
        onMovePlayerUp={(key, rowId) => setTeams((previous) => movePlayerUp(previous, key, rowId))}
        onMovePlayerDown={(key, rowId) => setTeams((previous) => movePlayerDown(previous, key, rowId))}
        onAddTeam={(name) => {
          const result = addTeam(teams, name);
          if (!result.added) return false;
          setTeams(result.teams);
          return true;
        }}
        onRemoveTeam={handleRemoveTeam}
        onRestoreTeam={handleRestoreTeam}
      />
      <RosterOutput
        copyText={copyText}
        csvText={csvText}
        printModel={printModel}
        unresolvedCount={blockingCount}
        onReset={onReset}
      />
    </div>
  );
}

function countPlayers(teams: ReadonlyArray<WorkingTeam>): number {
  return teams.reduce((total, team) => total + team.players.length, 0);
}
