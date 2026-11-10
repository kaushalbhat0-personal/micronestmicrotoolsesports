/**
 * Finder — game + role model.
 *
 * Roles live in code/config, never as database tables. Adding a game means
 * adding one entry to GAME_ROLES plus a matching CHECK expansion in a
 * future additive migration — the Finder identity model does not change.
 */

export const SUPPORTED_GAMES = ["bgmi"] as const;

export type SupportedGame = (typeof SUPPORTED_GAMES)[number];

export const BGMI_ROLES = ["IGL", "Assaulter", "Support", "Scout"] as const;

export type BgmiRole = (typeof BGMI_ROLES)[number];

/**
 * Reserved for future MLBB support. Referenced by type only — no UI,
 * no data, no migration. Kept here so game-specific roles stay out of
 * the generic player/team entities from day one.
 */
export const MLBB_ROLES = ["EXP", "Jungle", "Mid", "Gold", "Roam"] as const;

export type MlbbRole = (typeof MLBB_ROLES)[number];

export const GAME_ROLES: Record<SupportedGame, ReadonlyArray<string>> = {
  bgmi: BGMI_ROLES,
};

export function isSupportedGame(value: unknown): value is SupportedGame {
  return (
    typeof value === "string" &&
    (SUPPORTED_GAMES as ReadonlyArray<string>).includes(value)
  );
}

export function isRoleForGame(game: SupportedGame, role: unknown): boolean {
  return (
    typeof role === "string" && (GAME_ROLES[game] as ReadonlyArray<string>).includes(role)
  );
}

/** Broad region tokens treated as "open to any region" during matching. */
const ANY_REGION_TOKENS = new Set(["any", "all", "pan-india", "online"]);

export function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

/**
 * Region compatibility (hard filter): equal broad regions, or either side
 * declares itself open to any region. Never compares exact locations —
 * Finder regions are intentionally broad.
 */
export function regionsCompatible(a: string, b: string): boolean {
  const left = normalizeRegion(a);
  const right = normalizeRegion(b);
  if (left === right) return true;
  return ANY_REGION_TOKENS.has(left) || ANY_REGION_TOKENS.has(right);
}
