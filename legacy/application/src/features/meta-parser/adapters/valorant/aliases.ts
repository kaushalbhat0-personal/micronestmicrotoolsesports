/**
 * VALORANT alias resolution (V1: heading-derived, no external source).
 *
 * No authoritative structured alias companion was verified for VALORANT,
 * so V1 deliberately introduces no community-API dependency. Canonical
 * display names come from patch headings in situ; this module resolves a
 * heading to its display form through the (usually empty) alias map first,
 * exactly like the Dota resolver shape, then falls back to the cleaned
 * heading. The shared pipeline seeds observed names per game.
 */

import { normalizeEntityName } from "../../services/entity-normalize";

export type ValorantAliasHit = "canonical" | "fallback";

export interface ValorantAliasResolution {
  readonly displayName: string;
  readonly normalized: string;
  readonly hit: ValorantAliasHit;
}

/** Strip markdown/bold remnants and collapse whitespace (keeps casing). */
export function canonicalizeValorantName(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Resolve a patch heading to a display name via the alias map, else fallback. */
export function resolveValorantName(
  heading: string,
  aliasMap: ReadonlyMap<string, string>
): ValorantAliasResolution {
  const canonical = canonicalizeValorantName(heading);
  if (canonical === "") return { displayName: heading, normalized: "", hit: "fallback" };
  const hit = aliasMap.get(canonical) ?? aliasMap.get(normalizeEntityName(canonical));
  if (hit !== undefined) {
    return { displayName: hit, normalized: normalizeEntityName(hit), hit: "canonical" };
  }
  return { displayName: canonical, normalized: normalizeEntityName(canonical), hit: "fallback" };
}
