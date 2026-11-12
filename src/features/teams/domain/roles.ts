// D1 teams domain — game + role model (REIMPLEMENT from legacy finder roles).
// Legacy: legacy/application/src/features/finder/domain/roles.ts
// D1 decisions:
// - Supported game is BGMI only (matches public.games seed + G1 vocabularies).
// - Roles live in code, never as DB tables. Adding a game adds an entry + migration CHECK.
// - MLBB roles reserved as type only (never enabled, never validated).
// - Region compatibility uses broad tokens in legacy; new model MUST use
//   game-specific region_code vocabularies (G1 BGMI set). normalizeRegion /
//   regionsCompatible are preserved for migration reference and MUST NOT be
//   used with free-text regions in new code (see 04-finder-domain-contracts.md).
export const SUPPORTED_GAMES = ["bgmi"] as const;

export type SupportedGame = (typeof SUPPORTED_GAMES)[number];

export const BGMI_ROLES = ["IGL", "Assaulter", "Support", "Scout"] as const;

export type BgmiRole = (typeof BGMI_ROLES)[number];

/** Reserved for future MLBB support. Type only — no UI, no data, no migration. */
export const MLBB_ROLES = ["EXP", "Jungle", "Mid", "Gold", "Roam"] as const;

export type MlbbRole = (typeof MLBB_ROLES)[number];

export const GAME_ROLES: Record<SupportedGame, ReadonlyArray<string>> = {
  bgmi: BGMI_ROLES,
};

export function isSupportedGame(value: unknown): value is SupportedGame {
  return typeof value === "string" && (SUPPORTED_GAMES as ReadonlyArray<string>).includes(value);
}

export function isRoleForGame(game: SupportedGame, role: unknown): boolean {
  return typeof role === "string" && (GAME_ROLES[game] as ReadonlyArray<string>).includes(role);
}

const ANY_REGION_TOKENS = new Set(["any", "all", "pan-india", "online"]);

export function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

/** Legacy broad-region compatibility. New code must prefer vocabulary-checked region_code. */
export function regionsCompatible(a: string, b: string): boolean {
  const left = normalizeRegion(a);
  const right = normalizeRegion(b);
  if (left === right) return true;
  return ANY_REGION_TOKENS.has(left) || ANY_REGION_TOKENS.has(right);
}
