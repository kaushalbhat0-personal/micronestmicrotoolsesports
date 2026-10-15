/**
 * Dota hero alias resolution.
 *
 * Lookup order (no fuzzy matching):
 *   exact canonical match → alias match → normalized fallback.
 *
 * Canonical names come from OpenDota /api/heroes (`localized_name`);
 * hero_key is the dataset key without the npc_dota_hero_ prefix
 * (e.g. "rattletrap" → "Clockwerk").
 */

import { normalizeEntityName } from "../../services/entity-normalize";

export interface HeroAliasEntry {
  readonly heroKey: string;
  readonly canonicalName: string;
}

interface HeroApiRow {
  readonly name: string;
  readonly localized_name: string;
}

const NPC_PREFIX = "npc_dota_hero_";

export function heroKeyFromApiName(apiName: string): string | null {
  if (!apiName.startsWith(NPC_PREFIX)) return null;
  const key = apiName.slice(NPC_PREFIX.length);
  return key === "" ? null : key;
}

/** Build a key→canonical map from /api/heroes rows. Skips malformed rows. */
export function buildAliasMap(rows: readonly HeroApiRow[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (typeof row.name !== "string" || typeof row.localized_name !== "string") continue;
    const key = heroKeyFromApiName(row.name);
    const canonical = row.localized_name.trim();
    if (key === null || canonical === "") continue;
    if (!map.has(key)) map.set(key, canonical);
  }
  return map;
}

export type AliasHit = "canonical" | "alias" | "fallback";

export interface AliasResolution {
  readonly displayName: string;
  readonly normalized: string;
  readonly hit: AliasHit;
}

/**
 * Resolve a dataset hero_key to a display name.
 * checkedIn covers keys whose canonical name is known without the API
 * (verified mappings, e.g. rattletrap → Clockwerk).
 */
export function resolveHeroName(
  heroKey: string,
  apiMap: ReadonlyMap<string, string>,
  checkedIn: ReadonlyMap<string, string> = CHECKED_IN_ALIASES
): AliasResolution {
  const canonical = apiMap.get(heroKey) ?? checkedIn.get(heroKey);
  if (canonical !== undefined) {
    return { displayName: canonical, normalized: normalizeEntityName(canonical), hit: "canonical" };
  }
  const fallback = heroKey.replace(/_/g, " ");
  return { displayName: fallback, normalized: normalizeEntityName(fallback), hit: "fallback" };
}

/**
 * Checked-in verified mappings (subset of /api/heroes, kept tiny on purpose).
 * The live API map always wins; this only covers offline/test paths.
 */
export const CHECKED_IN_ALIASES: ReadonlyMap<string, string> = new Map([
  ["rattletrap", "Clockwerk"],
  ["wisp", "Io"],
  ["necrolyte", "Necrophos"],
  ["nevermore", "Shadow Fiend"],
  ["furion", "Nature's Prophet"],
  ["windrunner", "Windranger"],
  ["zuus", "Zeus"],
]);
