// P7 tie-break & qualification simulator — Zod input boundaries.
// All user text enters as raw strings and is validated here before the pure
// engine touches it. Scores and weights are integers only: totals are exact
// sums of value × weight with no floating point anywhere. Bounds are hard so
// no control can inject oversized or malformed data; the engine re-validates
// defensively and throws ScenarioError (never NaN, never silent coercion).
//
// Nothing here encodes an official rulebook. Criterion names, weights,
// directions and priority are user configuration; the engine only applies
// them deterministically.

import { z } from "zod";

export const MAX_TEAMS = 24;
export const MAX_CRITERIA = 8;
export const MAX_SCENARIO_NAME_LENGTH = 48;
export const MAX_TEAM_NAME_LENGTH = 40;
export const MAX_CRITERION_NAME_LENGTH = 32;

/** Criterion values are whole numbers; missing entries are allowed. */
export const MIN_SCORE_VALUE = -1_000_000;
export const MAX_SCORE_VALUE = 1_000_000;

/**
 * Weights are whole numbers. Zero is allowed: the criterion still counts
 * for tie-breaks but adds nothing to the total. Negative weights model
 * penalties (e.g. deaths subtract from a total).
 */
export const MIN_WEIGHT = -1000;
export const MAX_WEIGHT = 1000;

/** Cutoff 0 means "no qualification cutoff configured". */
export const MIN_CUTOFF = 0;
export const MAX_CUTOFF = MAX_TEAMS;

export const SCORE_DIRECTIONS = ["high", "low"] as const;

export type ScoreDirection = (typeof SCORE_DIRECTIONS)[number];

export function isScoreDirection(value: unknown): value is ScoreDirection {
  return value === "high" || value === "low";
}

export function directionLabel(direction: ScoreDirection): string {
  return direction === "high" ? "Higher wins" : "Lower wins";
}

const integerInRange = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^-?\d{1,8}$/, message)
    .refine(
      (raw) => {
        const parsed = Number(raw);
        return Number.isInteger(parsed) && parsed >= min && parsed <= max;
      },
      { message },
    );

export const scenarioFormSchema = z
  .object({
    name: z.string().trim().max(MAX_SCENARIO_NAME_LENGTH).optional().default(""),
    cutoff: z.coerce.number().int().min(MIN_CUTOFF).max(MAX_CUTOFF),
  })
  .strict();

export type ScenarioFormInput = z.infer<typeof scenarioFormSchema>;

export const teamFormSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Team name must be 2–40 characters")
      .max(MAX_TEAM_NAME_LENGTH, "Team name must be 2–40 characters"),
  })
  .strict();

export type TeamFormInput = z.infer<typeof teamFormSchema>;

export const criterionFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Criterion name must be 2–32 characters")
      .max(MAX_CRITERION_NAME_LENGTH, "Criterion name must be 2–32 characters"),
    weight: z.coerce.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT),
    direction: z.enum(SCORE_DIRECTIONS),
  })
  .strict();

export type CriterionFormInput = z.infer<typeof criterionFormSchema>;

export const scoreValueSchema = integerInRange(
  MIN_SCORE_VALUE,
  MAX_SCORE_VALUE,
  `Enter a whole number from ${MIN_SCORE_VALUE} to ${MAX_SCORE_VALUE}`,
);

/** Parse a raw score field: "" = missing (not an error), else a bounded int. */
export function parseScoreField(raw: string): { ok: true; value: number | null } | { ok: false } {
  if (raw.trim() === "") {
    return { ok: true, value: null };
  }
  return scoreValueSchema.safeParse(raw).success
    ? { ok: true, value: Number(raw.trim()) }
    : { ok: false };
}
