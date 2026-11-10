import type { CompetitionResult, RuleEvaluation, RuleId, ScoringConfig, TeamAggregates } from "../types";

/**
 * Tie-Breaker Resolver — Rule evaluators.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Every evaluator returns values per team plus whether the rule can
 * separate anyone in the subgroup. Missing data yields NO separation —
 * the engine moves on instead of manufacturing a result.
 */

function emptyAggregates(teamId: string): TeamAggregates {
  return {
    teamId,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    mapsWon: 0,
    mapsLost: 0,
    mapDiff: 0,
    hasMapData: false,
    roundsWon: 0,
    roundsLost: 0,
    roundDiff: 0,
    hasRoundData: false,
  };
}

function hasMaps(r: CompetitionResult): boolean {
  return r.mapsA !== undefined && r.mapsA !== null && r.mapsB !== undefined && r.mapsB !== null;
}

function hasRounds(r: CompetitionResult): boolean {
  return r.roundsA !== undefined && r.roundsA !== null && r.roundsB !== undefined && r.roundsB !== null;
}

export function computeAggregates(
  teamIds: readonly string[],
  results: readonly CompetitionResult[],
  scoring: ScoringConfig,
): Map<string, TeamAggregates> {
  const acc = new Map<string, TeamAggregates>();
  for (const id of teamIds) acc.set(id, emptyAggregates(id));

  for (const r of results) {
    if (!r.isComplete) continue;
    const a = acc.get(r.teamAId);
    const b = acc.get(r.teamBId);
    if (!a || !b) continue;
    if (r.outcome.kind === "draw") {
      acc.set(r.teamAId, { ...a, points: a.points + scoring.draw, draws: a.draws + 1 });
      acc.set(r.teamBId, { ...b, points: b.points + scoring.draw, draws: b.draws + 1 });
    } else {
      const winnerId = r.outcome.winnerTeamId;
      const loserId = winnerId === r.teamAId ? r.teamBId : r.teamAId;
      const w = acc.get(winnerId);
      const l = acc.get(loserId);
      if (!w || !l) continue;
      acc.set(winnerId, { ...w, points: w.points + scoring.win, wins: w.wins + 1 });
      acc.set(loserId, { ...l, points: l.points + scoring.loss, losses: l.losses + 1 });
    }
    if (hasMaps(r)) {
      const mapsA = r.mapsA as number;
      const mapsB = r.mapsB as number;
      const na = acc.get(r.teamAId) as TeamAggregates;
      const nb = acc.get(r.teamBId) as TeamAggregates;
      acc.set(r.teamAId, {
        ...na,
        mapsWon: na.mapsWon + mapsA,
        mapsLost: na.mapsLost + mapsB,
        mapDiff: na.mapDiff + (mapsA - mapsB),
        hasMapData: true,
      });
      acc.set(r.teamBId, {
        ...nb,
        mapsWon: nb.mapsWon + mapsB,
        mapsLost: nb.mapsLost + mapsA,
        mapDiff: nb.mapDiff + (mapsB - mapsA),
        hasMapData: true,
      });
    }
    if (hasRounds(r)) {
      const roundsA = r.roundsA as number;
      const roundsB = r.roundsB as number;
      const ra = acc.get(r.teamAId) as TeamAggregates;
      const rb = acc.get(r.teamBId) as TeamAggregates;
      acc.set(r.teamAId, {
        ...ra,
        roundsWon: ra.roundsWon + roundsA,
        roundsLost: ra.roundsLost + roundsB,
        roundDiff: ra.roundDiff + (roundsA - roundsB),
        hasRoundData: true,
      });
      acc.set(r.teamBId, {
        ...rb,
        roundsWon: rb.roundsWon + roundsB,
        roundsLost: rb.roundsLost + roundsA,
        roundDiff: rb.roundDiff + (roundsB - roundsA),
        hasRoundData: true,
      });
    }
  }
  return acc;
}

/**
 * Head-to-head mini-table: points earned in matches played ONLY between
 * the currently tied subgroup members. Returns null values when the
 * subgroup has no internal completed matches (rule unusable there).
 */
export function computeHeadToHead(
  memberIds: readonly string[],
  results: readonly CompetitionResult[],
  scoring: ScoringConfig,
): Map<string, number> | null {
  const members = new Set(memberIds);
  const internal = results.filter((r) => r.isComplete && members.has(r.teamAId) && members.has(r.teamBId));
  if (internal.length === 0) return null;
  const table = new Map<string, number>();
  for (const id of memberIds) table.set(id, 0);
  for (const r of internal) {
    if (r.outcome.kind === "draw") {
      table.set(r.teamAId, (table.get(r.teamAId) as number) + scoring.draw);
      table.set(r.teamBId, (table.get(r.teamBId) as number) + scoring.draw);
    } else {
      table.set(r.outcome.winnerTeamId, (table.get(r.outcome.winnerTeamId) as number) + scoring.win);
      const loser = r.outcome.winnerTeamId === r.teamAId ? r.teamBId : r.teamAId;
      table.set(loser, (table.get(loser) as number) + scoring.loss);
    }
  }
  return table;
}

export interface RuleOutcome {
  readonly evaluation: RuleEvaluation;
  /** True when every member has a usable value AND at least two distinct values exist. */
  readonly separates: boolean;
  /** Members ordered best-first by this rule. Empty when the rule does not separate. */
  readonly partitions: readonly (readonly string[])[];
}

function distinctCount(values: readonly (number | null)[]): number {
  return new Set(values.filter((v): v is number => v !== null)).size;
}

export function evaluateRule(
  rule: RuleId,
  memberIds: readonly string[],
  aggregates: Readonly<Map<string, TeamAggregates>>,
  results: readonly CompetitionResult[],
  scoring: ScoringConfig,
): RuleOutcome {
  const values: Record<string, number | null> = {};
  let note: string;

  if (rule === "h2h") {
    const table = computeHeadToHead(memberIds, results, scoring);
    if (!table) {
      for (const id of memberIds) values[id] = null;
      note = "Head-to-head could not be used — these teams have not played each other yet";
    } else {
      for (const id of memberIds) values[id] = table.get(id) ?? 0;
      note = "Head-to-head mini-table among the tied teams";
    }
  } else if (rule === "points") {
    for (const id of memberIds) values[id] = aggregates.get(id)?.points ?? 0;
    note = "Competition points";
  } else if (rule === "wins") {
    for (const id of memberIds) values[id] = aggregates.get(id)?.wins ?? 0;
    note = "Matches won";
  } else if (rule === "map_diff") {
    const usable = memberIds.every((id) => aggregates.get(id)?.hasMapData === true);
    for (const id of memberIds) {
      const agg = aggregates.get(id);
      values[id] = agg && usable ? agg.mapDiff : null;
    }
    note = usable ? "Maps won minus maps lost" : "Map difference needs map scores for every tied team";
  } else {
    const usable = memberIds.every((id) => aggregates.get(id)?.hasRoundData === true);
    for (const id of memberIds) {
      const agg = aggregates.get(id);
      values[id] = agg && usable ? agg.roundDiff : null;
    }
    note = usable ? "Rounds won minus rounds lost" : "Round difference needs round scores for every tied team";
  }

  const ordered = memberIds.filter((id) => values[id] !== null);
  const canUse = ordered.length === memberIds.length;
  const separates = canUse && distinctCount(memberIds.map((id) => values[id] ?? null)) > 1;

  let partitions: readonly (readonly string[])[] = [];
  if (separates) {
    const groups = new Map<number, string[]>();
    for (const id of memberIds) {
      const v = values[id] as number;
      const list = groups.get(v) ?? [];
      list.push(id);
      groups.set(v, list);
    }
    partitions = [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, list]) => list);
  }

  return { evaluation: { rule, values, separated: separates, note }, separates, partitions };
}
