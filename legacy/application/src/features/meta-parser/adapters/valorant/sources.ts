/**
 * VALORANT source configuration.
 *
 * Discovery: official patch-notes listing (HTML, every run).
 * Corpus: latest article pages (HTML text, only when discovery proves a
 * target patch is missing or when hashing). No fallback source and no
 * external alias API in V1 — heading-derived names are sufficient.
 *
 * Provenance is always the official Riot Games VALORANT patch page
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
 *     ('valorant', 'VALORANT', 'valorant', 'daily', 'valorant-numeric',
 *      'https://playvalorant.com/en-us/news/game-updates/',
 *      array['playvalorant.com'],
 *      '{"sections": ["agents", "weapons", "maps", "systems"], "delimiters": [">>>"], "provenance": {"sourceLabel": "Riot Games — VALORANT"}}',
 *      true)
 *   on conflict (slug) do nothing;
 */

export const VALORANT_ADAPTER_KEY = "valorant" as const;
export const VALORANT_GAME_SLUG = "valorant" as const;
export const VALORANT_ADAPTER_VERSION = "valorant.1" as const;
export const VALORANT_PARSER_VERSION = "valorant-html.1" as const;

/** Human-readable canonical source label (data-driven provenance). */
export const VALORANT_SOURCE_LABEL = "Riot Games — VALORANT" as const;

export const VALORANT_ALLOWED_HOSTS = ["playvalorant.com"] as const;

export const VALORANT_PATCH_INDEX_URL = "https://playvalorant.com/en-us/news/game-updates/";

/**
 * Listing page cap (1 MiB).
 *
 * Production measurement (2026-10-15): the official Riot listing returns
 * ~554 KB (heavy Next.js app shell), which exceeded the previous 512 KiB
 * cap and failed discovery with "Upstream response exceeded size cap"
 * before any patch was persisted. 1 MiB leaves ~470 KB headroom while
 * keeping the streaming size guard strict. Article cap unchanged.
 */
export const VALORANT_PATCH_INDEX_MAX_BYTES = 1024 * 1024;

/** Single article cap (long-form patch pages with images referenced, not fetched). */
export const VALORANT_PATCH_PAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Bounded article window per corpus fetch. Mirrors the route BACKFILL_MAX
 * so a corpus fetch always covers any legal backfill depth.
 */
export const VALORANT_CORPUS_PAGES_MAX = 5;

/** "13-08" (URL slug) → "13.08" (display version). */
export function patchSlugToVersion(slug: string): string | null {
  const match = /^(\d+)-(\d+)$/.exec(slug);
  if (!match?.[1] || !match?.[2]) return null;
  return `${match[1]}.${match[2]}`;
}

/** "13.08" → "13-08". Returns null for malformed versions. */
export function versionToPatchSlug(version: string): string | null {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match?.[1] || !match?.[2]) return null;
  return `${match[1]}-${match[2]}`;
}

/** "13.08" → "13_08" (opaque dataset key for the corpus map). */
export function versionToDatasetKey(version: string): string | null {
  if (!/^\d+\.\d+$/.test(version)) return null;
  return version.replace(".", "_");
}

/** "13_08" → "13.08". Returns null for malformed keys. */
export function datasetKeyToVersion(key: string): string | null {
  if (!/^\d+_\d+$/.test(key)) return null;
  return key.replace("_", ".");
}

/**
 * Deterministic monotonic upstream id ("13.08" → 13008).
 * Source-derived ordering key for the stored-max fast path.
 */
export function upstreamIdForVersion(version: string): number | null {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match?.[1] || !match?.[2]) return null;
  return Number(match[1]) * 1000 + Number(match[2]);
}

/** Canonical Riot provenance URL (recorded per patch, never fetched for content). */
export function valorantPatchUrl(version: string): string {
  const slug = versionToPatchSlug(version) ?? version.replace(".", "-");
  return `https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-${slug}`;
}
