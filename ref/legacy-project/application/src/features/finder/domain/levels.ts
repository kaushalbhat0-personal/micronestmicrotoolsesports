/**
 * Finder — competitive level model.
 *
 * Pure domain constants. No React, no Supabase, no browser APIs.
 *
 * Levels are SELF-REPORTED competitive context, never MicroNest ratings.
 * Practice scores, Lab activity, and tournament records must never be
 * presented as skill verification. Only Tournament Hub roster records
 * (when linked) count as independently supported evidence.
 */

export const COMPETITIVE_LEVELS = [
  "casual",
  "community",
  "competitive",
  "higher-tier",
  "semi-pro",
  "professional",
] as const;

export type CompetitiveLevel = (typeof COMPETITIVE_LEVELS)[number];

/** Ordinal position on the Casual → Professional progression. */
const LEVEL_ORDER: Record<CompetitiveLevel, number> = {
  casual: 0,
  community: 1,
  competitive: 2,
  "higher-tier": 3,
  "semi-pro": 4,
  professional: 5,
};

/**
 * Hard-filter window for matching: a player whose current level is at most
 * ONE step below a post's minimum may apply. Stronger players may always
 * play down. Explainable without fake precision.
 */
export const LEVEL_WINDOW_BELOW = 1;

export function isCompetitiveLevel(value: unknown): value is CompetitiveLevel {
  return (
    typeof value === "string" &&
    (COMPETITIVE_LEVELS as ReadonlyArray<string>).includes(value)
  );
}

export function levelIndex(level: CompetitiveLevel): number {
  return LEVEL_ORDER[level];
}

/**
 * Is the player's self-reported current level acceptable for a post that
 * requires at least `minimum`? Pure comparison, no data access.
 */
export function meetsLevelMinimum(
  playerCurrent: CompetitiveLevel,
  minimum: CompetitiveLevel,
): boolean {
  return levelIndex(playerCurrent) >= levelIndex(minimum) - LEVEL_WINDOW_BELOW;
}

/** Display copy guard: levels must always be framed as self-reported. */
export const SELF_REPORTED_LEVEL_NOTE =
  "Self-reported competitive context, not a MicroNest rating.";
