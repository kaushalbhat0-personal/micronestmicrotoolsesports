/**
 * BGMI Tournament Hub — point calculation.
 *
 * Single source of truth for the KRAFTON 2026 scoring table
 * (BMSD 2026 Official Competition Rulebook v1.0.0 §14.1, mirrored by the
 * Liquipedia `Points10` template: 1st=10, 2nd=6, 3rd=5, 4th=4, 5th=3,
 * 6th=2, 7th–8th=1, 9th–16th=0, +1 per finish).
 *
 * The adapter always parses the source-declared p1..p8/p_kill values and
 * this module cross-checks them against the canonical table — a changed
 * source table fails validation instead of silently changing scoring.
 */

export const BGMI_POINTS_TABLE_2026: readonly number[] = [10, 6, 5, 4, 3, 2, 1, 1] as const;
export const BGMI_FINISH_POINT_VALUE_2026 = 1;
export const BGMI_MAX_PLACEMENT = 16;

export function placementPointsFor(placement: number, table: readonly number[] = BGMI_POINTS_TABLE_2026): number {
  if (!Number.isInteger(placement) || placement < 1) return 0;
  return table[placement - 1] ?? 0;
}

export interface MatchTotalInput {
  readonly placement: number;
  readonly finishes: number;
  readonly table?: readonly number[];
  readonly finishPointValue?: number;
}

/** placement points + finish points = match total. */
export function matchTotal(input: MatchTotalInput): {
  readonly placementPoints: number;
  readonly finishPoints: number;
  readonly total: number;
} {
  const table = input.table ?? BGMI_POINTS_TABLE_2026;
  const finishPointValue = input.finishPointValue ?? BGMI_FINISH_POINT_VALUE_2026;
  const placementPoints = placementPointsFor(input.placement, table);
  const finishPoints = Math.max(0, input.finishes) * finishPointValue;
  return { placementPoints, finishPoints, total: placementPoints + finishPoints };
}

/**
 * Stage total for one team:
 *   starting_points (carryover, e.g. League → Playoffs → Grand Finals)
 *   + SUM(match totals)
 */
export function stageTotal(startingPoints: number, matchTotals: readonly number[]): number {
  return Math.max(0, startingPoints) + matchTotals.reduce((sum, value) => sum + value, 0);
}

/** True when a source-declared table matches the canonical 2026 table. */
export function isCanonicalTable2026(table: readonly number[], finishPointValue: number): boolean {
  if (finishPointValue !== BGMI_FINISH_POINT_VALUE_2026) return false;
  if (table.length !== BGMI_POINTS_TABLE_2026.length) return false;
  return table.every((value, index) => value === BGMI_POINTS_TABLE_2026[index]);
}
