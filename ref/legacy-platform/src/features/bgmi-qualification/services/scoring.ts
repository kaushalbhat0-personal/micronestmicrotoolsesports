import type { CompareResult, ScoringPreset } from "../types";
import { BEST_CASE_POINTS_PER_MATCH, WORST_CASE_POINTS_PER_MATCH } from "./presets";

/**
 * BGMI Qualification Simulator — pure calculation engine.
 *
 * No JSX, no hooks, no network, no storage. Every function is
 * deterministic and independently unit-testable. Invalid input yields
 * null / explicit invalid results — never exceptions, never NaN surfacing.
 */

export const MAX_POINTS = 9999;
export const MAX_MATCHES = 100;

export function isValidPoints(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_POINTS;
}

export function isValidMatches(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_MATCHES;
}

export function isValidPlacement(preset: ScoringPreset, placement: unknown): placement is number {
  return (
    typeof placement === "number" &&
    Number.isInteger(placement) &&
    placement >= 1 &&
    placement <= preset.maxPlacement
  );
}

export function isValidFinishes(preset: ScoringPreset, finishes: unknown): finishes is number {
  return (
    typeof finishes === "number" &&
    Number.isInteger(finishes) &&
    finishes >= 0 &&
    finishes <= preset.maxFinishesPerMatch
  );
}

/** Placement points for a finishing position, or null when invalid. */
export function placementPoints(preset: ScoringPreset, placement: number): number | null {
  if (!isValidPlacement(preset, placement)) return null;
  const points = preset.placementPoints[placement - 1];
  return typeof points === "number" ? points : null;
}

export interface ScenarioPoints {
  readonly placementPoints: number;
  readonly finishPoints: number;
  readonly total: number;
}

/** One match hypothesis → points breakdown, or null when invalid. */
export function scenarioPoints(
  preset: ScoringPreset,
  placement: number,
  finishes: number
): ScenarioPoints | null {
  const pp = placementPoints(preset, placement);
  if (pp === null || !isValidFinishes(preset, finishes)) return null;
  const finishPoints = finishes * preset.finishPointValue;
  return { placementPoints: pp, finishPoints, total: pp + finishPoints };
}

/** Points still needed to reach the target (≤ 0 means already there). */
export function pointsGap(current: number, target: number): number {
  return target - current;
}

/** Required average per remaining match, or null when matches is 0. */
export function requiredRate(pointsNeeded: number, matchesRemaining: number): number | null {
  if (!isValidMatches(matchesRemaining) || matchesRemaining === 0) return null;
  return pointsNeeded / matchesRemaining;
}

/** Current + scenario → projected total. */
export function projectedTotal(current: number, scenarioPointsValue: number): number {
  return current + scenarioPointsValue;
}

/** Average-rate mode: current + average × remaining. Null on bad input. */
export function averageProjection(current: number, average: number, matchesRemaining: number): number | null {
  if (typeof average !== "number" || !Number.isFinite(average) || average < 0) return null;
  if (!isValidMatches(matchesRemaining)) return null;
  return current + average * matchesRemaining;
}

/** Projected vs target — the only comparison the tool ever claims. */
export function compareToTarget(projected: number, target: number): CompareResult {
  if (projected > target) return "above";
  if (projected === target) return "exact";
  return "below";
}

export interface PlanningBand {
  readonly best: number;
  readonly worst: number;
}

/** Assumption-based range over remaining matches. Labeled in UI, never guaranteed. */
export function planningBand(current: number, matchesRemaining: number): PlanningBand {
  return {
    best: current + matchesRemaining * BEST_CASE_POINTS_PER_MATCH,
    worst: current + matchesRemaining * WORST_CASE_POINTS_PER_MATCH,
  };
}

/** True only under explicit assumptions — never a mathematical guarantee. */
export function isOutOfReachUnderAssumptions(band: PlanningBand, target: number): boolean {
  return band.best < target;
}
