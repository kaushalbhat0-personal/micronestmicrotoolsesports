/**
 * League of Legends source configuration.
 *
 * Discovery: official patch-notes listing (HTML, every run).
 * Corpus: latest article pages (HTML text, only when discovery proves a
 * target patch is missing or when hashing). Aliases: Riot Data Dragon
 * (keyless static JSON, version-pinned per run — see aliases.ts).
 *
 * Provenance is always the official Riot Games patch article
 * (recorded per patch, rendered as the canonical source link).
 * Raw HTML is never persisted; only extracted plain-text facts are stored.
 *
 * Catalog row (existing `meta_parser_games` model — applied by operations,
 * NOT a migration file; ingestion stays inert until the row exists):
 *
 *   insert into public.meta_parser_games
 *     (slug, name, adapter_key, cadence, version_scheme, source_listing_url,
 *      allowed_hosts, expected_fields, is_active)
 *   values
 *     ('lol', 'League of Legends', 'lol', 'daily', 'lol-yearly',
 *      'https://www.leagueoflegends.com/en-us/news/game-updates/',
 *      array['www.leagueoflegends.com', 'leagueoflegends.com', 'ddragon.leagueoflegends.com'],
 *      '{"sections": ["champions", "items", "systems"], "delimiters": ["⇒"], "provenance": {"sourceLabel": "Riot Games — League of Legends", "datasetLabel": "Riot Data Dragon", "datasetUrl": "https://ddragon.leagueoflegends.com"}}',
 *      true)
 *   on conflict (slug) do nothing;
 *
 * COMMERCIAL-USE REVIEW OUTSTANDING: catalog activation is a technical
 * step only. Riot API Terms / Legal policy review for monetized LoL facts
 * is a separate release/business item and must NOT be treated as cleared.
 */

export const LOL_ADAPTER_KEY = "lol" as const;
export const LOL_GAME_SLUG = "lol" as const;
export const LOL_ADAPTER_VERSION = "lol.1" as const;
export const LOL_PARSER_VERSION = "lol-html.2" as const;

/** Human-readable canonical source label (data-driven provenance). */
export const LOL_SOURCE_LABEL = "Riot Games — League of Legends" as const;

/**
 * Exact V1 host allowlist. `leagueoflegends.com` (apex) is required because
 * it 301-redirects to `www.leagueoflegends.com`; `ddragon` serves aliases.
 * Image/CDN hosts, wikis, and TFT domains are deliberately absent — the
 * adapter never fetches images and never follows outbound article links.
 */
export const LOL_ALLOWED_HOSTS = [
  "www.leagueoflegends.com",
  "leagueoflegends.com",
  "ddragon.leagueoflegends.com",
] as const;

export const LOL_PATCH_INDEX_URL = "https://www.leagueoflegends.com/en-us/news/game-updates/";

/**
 * Listing page cap (1 MiB). The live listing measured ~511 KB (October
 * 2026 audit) — a 512 KiB cap would repeat the VALORANT outage. 1 MiB
 * leaves ~500 KB headroom while keeping the streaming size guard strict.
 */
export const LOL_PATCH_INDEX_MAX_BYTES = 1024 * 1024;

/** Single article cap (long-form patch pages with images referenced, not fetched). */
export const LOL_PATCH_PAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Per-resource Data Dragon cap (champion/item JSON; measured < 700 KB).
 * versions.json and the small datasets travel far below this bound.
 */
export const LOL_DDRAGON_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Bounded article window per corpus fetch. Mirrors the route BACKFILL_MAX
 * so a corpus fetch always covers any legal backfill depth. The raw
 * listing itself carries only the latest ~5 patch cards.
 */
export const LOL_CORPUS_PAGES_MAX = 5;

/** "26-20" (URL slug) → "26.20" (display version). */
export function patchSlugToVersion(slug: string): string | null {
  const match = /^(\d+)-(\d+)$/.exec(slug);
  if (!match?.[1] || !match?.[2]) return null;
  return `${match[1]}.${match[2]}`;
}

/** "26.20" → "26-20". Returns null for malformed versions. */
export function versionToPatchSlug(version: string): string | null {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match?.[1] || !match?.[2]) return null;
  return `${match[1]}-${match[2]}`;
}

/** "26.20" → "26_20" (opaque dataset key for the corpus map). */
export function versionToDatasetKey(version: string): string | null {
  if (!/^\d+\.\d+$/.test(version)) return null;
  return version.replace(".", "_");
}

/** "26_20" → "26.20". Returns null for malformed keys. */
export function datasetKeyToVersion(key: string): string | null {
  if (!/^\d+_\d+$/.test(key)) return null;
  return key.replace("_", ".");
}

/**
 * Deterministic monotonic upstream id ("26.20" → 26020).
 * Source-derived ordering key for the stored-max fast path.
 * 2026-era scheme is YEAR.NUM (see Riot patch schedule); pre-2026
 * SEASON.NUM versions sort under the same rule without colliding.
 */
export function upstreamIdForVersion(version: string): number | null {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match?.[1] || !match?.[2]) return null;
  return Number(match[1]) * 1000 + Number(match[2]);
}

/** Canonical Riot provenance URL (recorded per patch, never fetched for content). */
export function lolPatchUrl(version: string): string {
  const slug = versionToPatchSlug(version) ?? version.replace(".", "-");
  return `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-notes-${slug}`;
}

/**
 * Strict article-path guard: only official patch-note article paths may be
 * fetched. Relative listing hrefs are re-rooted before this check; anything
 * else (skins, trailers, wiki/TFT/community links) is rejected.
 */
export function isLoLArticlePath(pathname: string): boolean {
  return /^\/en-us\/news\/game-updates\/league-of-legends-patch-\d+-\d+-notes\/?$/.test(pathname);
}

/** Data Dragon versions index (keyless static JSON). */
export function lolDdragonVersionsUrl(): string {
  return "https://ddragon.leagueoflegends.com/api/versions.json";
}

/** Data Dragon dataset URL for a pinned version and dataset name. */
export function lolDdragonDatasetUrl(version: string, dataset: "champion" | "item"): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/${dataset}.json`;
}
