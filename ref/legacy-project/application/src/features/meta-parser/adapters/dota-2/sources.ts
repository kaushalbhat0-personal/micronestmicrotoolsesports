/**
 * Dota 2 source configuration.
 *
 * Primary discovery: patch.json (lightweight version/date index).
 * Primary changes: patchnotes.json (structured historical corpus).
 * Fallback: OpenDota /api/constants/patchnotes (same dataset over the API).
 * Canonical names: OpenDota /api/heroes (keyless).
 *
 * Provenance is always the OpenDota/dotaconstants community dataset (MIT).
 * Canonical Valve URL is recorded per patch but never fetched (unreachable
 * from some networks; must never block ingestion).
 */

export const DOTA_ADAPTER_KEY = "dota-2" as const;
export const DOTA_GAME_SLUG = "dota-2" as const;
export const DOTA_ADAPTER_VERSION = "dota-2.1" as const;
export const DOTA_PARSER_VERSION = "dotaconstants-structured.1" as const;

export const DOTA_ALLOWED_HOSTS = [
  "raw.githubusercontent.com",
  "api.github.com",
  "api.opendota.com",
] as const;

export const DOTA_PATCH_INDEX_URL =
  "https://raw.githubusercontent.com/odota/dotaconstants/master/build/patch.json";

export const DOTA_PATCHNOTES_URL =
  "https://raw.githubusercontent.com/odota/dotaconstants/master/build/patchnotes.json";

export const DOTA_PATCHNOTES_FALLBACK_URL = "https://api.opendota.com/api/constants/patchnotes";

export const DOTA_HEROES_URL = "https://api.opendota.com/api/heroes";

/** Hard cap comfortably above the verified ~2.6 MB corpus. */
export const DOTA_PATCHNOTES_MAX_BYTES = 8 * 1024 * 1024;

export const DOTA_PATCH_INDEX_MAX_BYTES = 64 * 1024;

/** "7_41" (dataset key) → "7.41" (display version). */
export function datasetKeyToVersion(key: string): string | null {
  if (!/^\d+_\d+[a-z]?$/.test(key)) return null;
  return key.replace("_", ".");
}

/** "7.41" → "7_41". Returns null for malformed versions. */
export function versionToDatasetKey(version: string): string | null {
  if (!/^\d+\.\d+[a-z]?$/.test(version)) return null;
  return version.replace(".", "_");
}

/** Canonical Valve provenance URL (recorded, never fetched by the adapter). */
export function valveProvenanceUrl(version: string): string {
  return `https://www.dota2.com/patches/${version}`;
}
