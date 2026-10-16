/**
 * BGMI Qualification Simulator — domain types.
 *
 * Everything the calculator needs is local: no auth, no DB, no network.
 * Share state is a small versioned JSON blob (base64url `?s=`), validated
 * on decode — malformed input must never crash the UI.
 */

/** Scoring configuration. Future tournaments are data, not code. */
export interface ScoringPreset {
  readonly id: string;
  readonly label: string;
  /** Placement → points, index 0 = 1st place. Length = maxPlacement. */
  readonly placementPoints: readonly number[];
  readonly finishPointValue: number;
  readonly maxPlacement: number;
  /** Max finishes accepted per match (practical cap, not a rule). */
  readonly maxFinishesPerMatch: number;
  readonly sourceLabel: string;
}

/** One what-if scenario: a single future match hypothesis. */
export interface QualificationScenario {
  readonly placement: number;
  readonly finishes: number;
}

/** Full calculator input snapshot — also the share-state payload core. */
export interface QualificationInput {
  readonly currentPoints: number;
  readonly targetPoints: number;
  readonly matchesRemaining: number;
  readonly presetId: string;
  readonly scenarios: readonly QualificationScenario[];
  readonly averageRate: number | null;
}

export type CompareResult = "above" | "exact" | "below";

export const QUALIFICATION_SHARE_VERSION = 1;

export interface QualificationShareState {
  readonly v: number;
  readonly current: number;
  readonly target: number;
  readonly matches: number;
  readonly preset: string;
  readonly scenarios: readonly QualificationScenario[];
  readonly averageRate: number | null;
}
