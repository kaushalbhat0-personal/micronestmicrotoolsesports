import { ZONE_PATTERN_DATASETS, type ZonePatternStageDataset } from "./zone-pattern-data";

/**
 * Zone Pattern Explorer — observable pattern model + deterministic aggregation.
 *
 * Pure data + pure functions: no React, no Supabase, no network. The island
 * is a thin renderer over these helpers so every displayed number is
 * unit-testable against the pinned dataset.
 *
 * HONESTY CONTRACT (no zone telemetry exists in the source):
 * every pattern below derives ONLY from published match results
 * (placement / finishes / total points) plus match metadata (map, day).
 * Nothing here describes where zones moved, where circles closed, or where
 * future zones will go. Interpretations are labelled as sample observations,
 * never as causes, guarantees, or predictions.
 */

export type { ZonePatternStageDataset } from "./zone-pattern-data";

export interface ZonePatternSelection {
  readonly dataset: string;
  readonly map: string;
  readonly day: string;
  readonly team: string;
}

export const ALL = "all";

export function datasetId(d: ZonePatternStageDataset): string {
  return `${d.tournamentSlug}/${d.stageSlug}`;
}

export function getDataset(id: string): ZonePatternStageDataset | null {
  return ZONE_PATTERN_DATASETS.find((d) => datasetId(d) === id) ?? null;
}

export interface ZonePatternMatchView {
  readonly number: number;
  readonly map: string;
  readonly day: string;
  readonly winnerName: string;
  readonly winnerFinishes: number;
  readonly winnerPoints: number;
  readonly rows: readonly { teamName: string; placement: number; finishes: number; totalPoints: number }[];
}

/** Matches in a dataset after map/day scoping. Team scoping never removes matches. */
export function selectMatches(
  dataset: ZonePatternStageDataset,
  map: string,
  day: string
): ZonePatternMatchView[] {
  return dataset.matches
    .filter((m) => (map === ALL || m.map === map) && (day === ALL || m.day === day))
    .map((m) => {
      const rows = m.rows.map((r) => ({
        teamName: dataset.teams[r.team]?.displayName ?? "Unknown team",
        placement: r.placement,
        finishes: r.finishes,
        totalPoints: r.totalPoints,
      }));
      const winner = rows.find((r) => r.placement === 1);
      return {
        number: m.number,
        map: m.map,
        day: m.day,
        winnerName: winner?.teamName ?? "Unknown team",
        winnerFinishes: winner?.finishes ?? 0,
        winnerPoints: winner?.totalPoints ?? 0,
        rows,
      };
    });
}

export interface PlacementBuckets {
  readonly wins: number;
  readonly top4: number;
  readonly top8: number;
  readonly bottom8: number;
  readonly total: number;
}

/**
 * Placement distribution over every team-appearance in the scoped matches.
 * wins ⊆ top4 ⊆ top8; bottom8 = placements 9–16.
 */
export function placementDistribution(matches: readonly ZonePatternMatchView[]): PlacementBuckets {
  let wins = 0;
  let top4 = 0;
  let top8 = 0;
  let total = 0;
  for (const m of matches) {
    for (const r of m.rows) {
      total += 1;
      if (r.placement === 1) wins += 1;
      if (r.placement <= 4) top4 += 1;
      if (r.placement <= 8) top8 += 1;
    }
  }
  return { wins, top4, top8, bottom8: total - top8, total };
}

export interface FinishesSummary {
  readonly total: number;
  readonly averagePerAppearance: number;
  readonly best: { teamName: string; finishes: number; matchNumber: number } | null;
}

export function finishesSummary(matches: readonly ZonePatternMatchView[]): FinishesSummary {
  let total = 0;
  let count = 0;
  let best: FinishesSummary["best"] = null;
  for (const m of matches) {
    for (const r of m.rows) {
      total += r.finishes;
      count += 1;
      if (!best || r.finishes > best.finishes) {
        best = { teamName: r.teamName, finishes: r.finishes, matchNumber: m.number };
      }
    }
  }
  return { total, averagePerAppearance: count === 0 ? 0 : total / count, best };
}

export interface PointsSummary {
  readonly averagePerAppearance: number;
  readonly averageWinningTotal: number;
  readonly best: { teamName: string; totalPoints: number; matchNumber: number } | null;
}

export function pointsSummary(matches: readonly ZonePatternMatchView[]): PointsSummary {
  let total = 0;
  let count = 0;
  let winTotal = 0;
  let best: PointsSummary["best"] = null;
  for (const m of matches) {
    winTotal += m.winnerPoints;
    for (const r of m.rows) {
      total += r.totalPoints;
      count += 1;
      if (!best || r.totalPoints > best.totalPoints) {
        best = { teamName: r.teamName, totalPoints: r.totalPoints, matchNumber: m.number };
      }
    }
  }
  return {
    averagePerAppearance: count === 0 ? 0 : total / count,
    averageWinningTotal: matches.length === 0 ? 0 : winTotal / matches.length,
    best,
  };
}

export interface TeamPatternRow {
  readonly teamName: string;
  readonly played: number;
  readonly wins: number;
  readonly top4: number;
  readonly top8: number;
  readonly averagePlacement: number;
  readonly totalFinishes: number;
  readonly totalPoints: number;
}

/**
 * Per-team aggregates over the scoped matches, sorted by average placement
 * (then total points). Describes the sample only — never a skill ranking.
 */
export function teamPatterns(matches: readonly ZonePatternMatchView[]): TeamPatternRow[] {
  const byTeam = new Map<string, { played: number; wins: number; top4: number; top8: number; placeSum: number; finishes: number; points: number }>();
  for (const m of matches) {
    for (const r of m.rows) {
      const acc = byTeam.get(r.teamName) ?? { played: 0, wins: 0, top4: 0, top8: 0, placeSum: 0, finishes: 0, points: 0 };
      acc.played += 1;
      if (r.placement === 1) acc.wins += 1;
      if (r.placement <= 4) acc.top4 += 1;
      if (r.placement <= 8) acc.top8 += 1;
      acc.placeSum += r.placement;
      acc.finishes += r.finishes;
      acc.points += r.totalPoints;
      byTeam.set(r.teamName, acc);
    }
  }
  return [...byTeam.entries()]
    .map(([teamName, a]) => ({
      teamName,
      played: a.played,
      wins: a.wins,
      top4: a.top4,
      top8: a.top8,
      averagePlacement: a.played === 0 ? 0 : a.placeSum / a.played,
      totalFinishes: a.finishes,
      totalPoints: a.points,
    }))
    .sort((a, b) => a.averagePlacement - b.averagePlacement || b.totalPoints - a.totalPoints);
}

export interface DayPatternRow {
  readonly day: string;
  readonly matches: number;
  readonly averageFinishesPerAppearance: number;
  readonly averagePointsPerAppearance: number;
  readonly winners: readonly string[];
}

/** Day-by-day progression over the scoped matches, in day order. */
export function dayPatterns(matches: readonly ZonePatternMatchView[]): DayPatternRow[] {
  const order = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
  const byDay = new Map<string, ZonePatternMatchView[]>();
  for (const m of matches) {
    const list = byDay.get(m.day) ?? [];
    list.push(m);
    byDay.set(m.day, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([day, list]) => {
      let finishes = 0;
      let points = 0;
      let count = 0;
      for (const m of list) {
        for (const r of m.rows) {
          finishes += r.finishes;
          points += r.totalPoints;
          count += 1;
        }
      }
      return {
        day,
        matches: list.length,
        averageFinishesPerAppearance: count === 0 ? 0 : finishes / count,
        averagePointsPerAppearance: count === 0 ? 0 : points / count,
        winners: list.map((m) => m.winnerName),
      };
    });
}

export interface MapPatternRow {
  readonly map: string;
  readonly matches: number;
  readonly averageFinishesPerAppearance: number;
  readonly averagePointsPerAppearance: number;
  readonly winners: readonly string[];
}

/** Per-map comparison over the scoped matches, in first-appearance order. */
export function mapPatterns(matches: readonly ZonePatternMatchView[]): MapPatternRow[] {
  const byMap = new Map<string, ZonePatternMatchView[]>();
  for (const m of matches) {
    const list = byMap.get(m.map) ?? [];
    list.push(m);
    byMap.set(m.map, list);
  }
  return [...byMap.entries()].map(([map, list]) => {
    let finishes = 0;
    let points = 0;
    let count = 0;
    for (const m of list) {
      for (const r of m.rows) {
        finishes += r.finishes;
        points += r.totalPoints;
        count += 1;
      }
    }
    return {
      map,
      matches: list.length,
      averageFinishesPerAppearance: count === 0 ? 0 : finishes / count,
      averagePointsPerAppearance: count === 0 ? 0 : points / count,
      winners: [...new Set(list.map((m) => m.winnerName))],
    };
  });
}

export function rate(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

export function formatAverage(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

export { ZONE_PATTERN_DATASETS };
