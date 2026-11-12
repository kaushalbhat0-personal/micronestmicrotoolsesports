// D1 teams domain — competitive levels (REIMPLEMENT from legacy finder levels).
// Legacy: legacy/application/src/features/finder/domain/levels.ts
// Self-reported context only, never a MicroNest rating.
export const COMPETITIVE_LEVELS = [
  "casual",
  "community",
  "competitive",
  "higher-tier",
  "semi-pro",
  "professional",
] as const;

export type CompetitiveLevel = (typeof COMPETITIVE_LEVELS)[number];

const LEVEL_ORDER: Record<CompetitiveLevel, number> = {
  casual: 0,
  community: 1,
  competitive: 2,
  "higher-tier": 3,
  "semi-pro": 4,
  professional: 5,
};

export const LEVEL_WINDOW_BELOW = 1;

export function isCompetitiveLevel(value: unknown): value is CompetitiveLevel {
  return typeof value === "string" && (COMPETITIVE_LEVELS as ReadonlyArray<string>).includes(value);
}

export function levelIndex(level: CompetitiveLevel): number {
  return LEVEL_ORDER[level];
}

export function meetsLevelMinimum(playerCurrent: CompetitiveLevel, minimum: CompetitiveLevel): boolean {
  return levelIndex(playerCurrent) >= levelIndex(minimum) - LEVEL_WINDOW_BELOW;
}

export const SELF_REPORTED_LEVEL_NOTE = "Self-reported competitive context, not a MicroNest rating.";
