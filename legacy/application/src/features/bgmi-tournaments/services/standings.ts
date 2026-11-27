/**
 * BGMI Tournament Hub — deterministic standings derivation.
 *
 * The ONLY standings computation. Both the public readers and the
 * ingestion self-checks use this: there is no competing source of truth.
 *
 *   total = starting_points + SUM(completed match totals)
 *
 * Rank order (documented on the stage page):
 *   1. total points (desc)
 *   2. wins / WWCDs (desc)
 *   3. placement points (desc)
 *   4. finishes (desc)
 *   5. best placement in the most recent completed match (asc)
 *
 * Smash Rule stages (match-point ending) are annotated by the caller —
 * this module ranks the points race only and never decides a winner.
 */

import type { BgmiMatch, BgmiStageEntry, BgmiStandingRow, BgmiTeam } from "../types";

export function deriveStandings(
  teams: readonly BgmiTeam[],
  entries: readonly BgmiStageEntry[],
  matches: readonly BgmiMatch[]
): BgmiStandingRow[] {
  const teamByKey = new Map(teams.map((t) => [t.canonicalName, t]));
  const completed = matches.filter((m) => m.status === "completed").sort((a, b) => a.matchNumber - b.matchNumber);

  interface Acc {
    wins: number;
    placementPoints: number;
    finishes: number;
    matchPoints: number;
    matchesPlayed: number;
    lastPlacement: number | null;
    lastMatchNumber: number;
  }

  const acc = new Map<string, Acc>();
  for (const entry of entries) {
    acc.set(entry.teamCanonical, {
      wins: 0,
      placementPoints: 0,
      finishes: 0,
      matchPoints: 0,
      matchesPlayed: 0,
      lastPlacement: null,
      lastMatchNumber: -1,
    });
  }

  for (const match of completed) {
    for (const result of match.results) {
      const row = acc.get(result.teamCanonical);
      if (!row) continue;
      row.matchPoints += result.totalPoints;
      row.placementPoints += result.placementPoints;
      row.finishes += result.finishes;
      row.matchesPlayed += 1;
      if (result.placement === 1) row.wins += 1;
      if (match.matchNumber >= row.lastMatchNumber) {
        row.lastMatchNumber = match.matchNumber;
        row.lastPlacement = result.placement;
      }
    }
  }

  const startingByTeam = new Map(entries.map((e) => [e.teamCanonical, e.startingPoints]));

  const rows = [...acc.entries()].map(([key, row]) => {
    const team = teamByKey.get(key);
    const startingPoints = startingByTeam.get(key) ?? 0;
    return {
      key,
      team,
      startingPoints,
      total: startingPoints + row.matchPoints,
      ...row,
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
    if (b.finishes !== a.finishes) return b.finishes - a.finishes;
    const aLast = a.lastPlacement ?? Number.MAX_SAFE_INTEGER;
    const bLast = b.lastPlacement ?? Number.MAX_SAFE_INTEGER;
    return aLast - bLast;
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    teamCanonical: row.key,
    displayName: row.team?.displayName ?? row.key,
    shortName: row.team?.shortName ?? row.key,
    logoUrl: row.team?.logoUrl ?? null,
    wins: row.wins,
    placementPoints: row.placementPoints,
    finishes: row.finishes,
    matchPoints: row.matchPoints,
    startingPoints: row.startingPoints,
    totalPoints: row.total,
    matchesPlayed: row.matchesPlayed,
  }));
}

/** Recompute stage totals from raw inputs — ingestion self-check helper. */
export function stageTotalsFrom(
  entries: readonly BgmiStageEntry[],
  matches: readonly BgmiMatch[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.teamCanonical, entry.startingPoints);
  for (const match of matches) {
    if (match.status !== "completed") continue;
    for (const result of match.results) {
      totals.set(result.teamCanonical, (totals.get(result.teamCanonical) ?? 0) + result.totalPoints);
    }
  }
  return totals;
}

export type { BgmiStandingRow };
