// D1 game catalogue — BGMI-first pattern (REIMPLEMENT).
// Legacy reference: legacy/application/src/config/games/catalog.ts
// Greenfield compatibility: public.games(key) + player_game_profiles(game_key).
// G1 BGMI seed: key 'bgmi', name 'Battlegrounds Mobile India', short 'BGMI'.
// Rules:
// - SUPPORTED = titles the product accepts today (creation + validation).
// - PLANNED = explicitly recognized but rejected (never silently accepted).
// - Aliases normalize case/whitespace; unknown input returns undefined, never throws.
// - Slugs never drive auth/entitlement; never treated as DB FKs here.

export type SupportedGameKey = "bgmi";
export type PlannedGameKey = "mlbb";

export interface GameIdentity {
  readonly key: SupportedGameKey;
  readonly name: string;
  readonly shortName: string;
  readonly aliases: ReadonlyArray<string>;
}

const BGMI_IDENTITY: GameIdentity = {
  key: "bgmi",
  name: "Battlegrounds Mobile India",
  shortName: "BGMI",
  aliases: ["BGMI", "PUBG Mobile", "Battlegrounds Mobile India", "pubg-mobile"],
};

export const SUPPORTED_GAMES: ReadonlyArray<GameIdentity> = [BGMI_IDENTITY];

export const SUPPORTED_GAME_KEYS: ReadonlyArray<SupportedGameKey> = ["bgmi"];

/** Recognized but NOT enabled. Any use must be rejected with a planned-title error. */
export const PLANNED_GAME_KEYS: ReadonlyArray<PlannedGameKey> = ["mlbb"];

const BY_KEY = new Map<string, GameIdentity>(SUPPORTED_GAMES.map((g) => [g.key, g]));

const BY_ALIAS = new Map<string, GameIdentity>();
for (const game of SUPPORTED_GAMES) {
  for (const alias of game.aliases) {
    BY_ALIAS.set(alias.trim().toLowerCase(), game);
  }
}

export function getGameByKey(key: string): GameIdentity | undefined {
  const normalized = key.trim().toLowerCase();
  return BY_KEY.get(normalized) ?? BY_ALIAS.get(normalized);
}

export function isSupportedGameKey(value: unknown): value is SupportedGameKey {
  return typeof value === "string" && (SUPPORTED_GAME_KEYS as ReadonlyArray<string>).includes(value.trim().toLowerCase());
}

export function isPlannedGameKey(value: unknown): value is PlannedGameKey {
  return typeof value === "string" && (PLANNED_GAME_KEYS as ReadonlyArray<string>).includes(value.trim().toLowerCase());
}

/**
 * Resolve caller input to a supported key. Returns undefined for planned and
 * unknown titles alike; callers distinguish via isPlannedGameKey for messaging.
 */
export function resolveSupportedGameKey(input: string): SupportedGameKey | undefined {
  return getGameByKey(input)?.key;
}
