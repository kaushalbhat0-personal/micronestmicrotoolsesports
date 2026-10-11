/**
 * Shared game identity catalog — RCCF-GAME-CATALOG Phase 1.
 *
 * Static product configuration only. This module is the single authoritative
 * source for first-wave game identities (slug + display names).
 *
 * Boundaries (do not expand this module):
 * - Display/product configuration values only. Slugs are NOT auth inputs
 *   and MUST NEVER drive authorization, entitlement, or security decisions.
 * - Slugs are NOT database foreign keys. No table references them.
 * - No tool-specific preset logic lives here. Each tool owns its own
 *   preset module and imports only the `GameSlug` type from this catalog.
 * - No runtime services, no Supabase, no network calls. Pure static data.
 * - Mobile Legends is deliberately second-wave and MUST NOT be added here
 *   until product approves wave two.
 */
export type GameSlug =
  | "cs2"
  | "valorant"
  | "league-of-legends"
  | "dota-2"
  | "rainbow-six-siege"
  | "pubg-mobile"
  | "fortnite"
  | "rocket-league"
  | "apex-legends"
  | "call-of-duty";

export interface GameIdentity {
  readonly slug: GameSlug;
  readonly name: string;
  readonly shortName: string;
  readonly aliases?: readonly string[];
}

export const GAMES: readonly GameIdentity[] = [
  { slug: "cs2", name: "Counter-Strike 2", shortName: "CS2" },
  { slug: "valorant", name: "Valorant", shortName: "VAL" },
  {
    slug: "league-of-legends",
    name: "League of Legends",
    shortName: "LoL",
    aliases: ["LoL"],
  },
  { slug: "dota-2", name: "Dota 2", shortName: "Dota 2" },
  { slug: "rainbow-six-siege", name: "Rainbow Six Siege", shortName: "R6" },
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    shortName: "PM",
    aliases: ["BGMI", "Battlegrounds Mobile India"],
  },
  { slug: "fortnite", name: "Fortnite", shortName: "FN" },
  { slug: "rocket-league", name: "Rocket League", shortName: "RL" },
  { slug: "apex-legends", name: "Apex Legends", shortName: "ALGS" },
  {
    slug: "call-of-duty",
    name: "Call of Duty",
    shortName: "COD",
    aliases: ["CoD"],
  },
];

const BY_SLUG: ReadonlyMap<string, GameIdentity> = new Map(
  GAMES.map((game) => [game.slug, game] as const)
);

const BY_ALIAS: ReadonlyMap<string, GameIdentity> = new Map(
  GAMES.flatMap((game) =>
    (game.aliases ?? []).map(
      (alias) => [alias.toLowerCase(), game] as const
    )
  )
);

/**
 * Pure slug lookup. Returns the game identity or `undefined` for unknown
 * input. Accepts canonical slugs and the documented display aliases
 * (case-insensitive). Never throws, never touches I/O.
 */
export function getGameBySlug(slug: string): GameIdentity | undefined {
  const direct = BY_SLUG.get(slug);
  if (direct !== undefined) return direct;
  return BY_ALIAS.get(slug.toLowerCase());
}
