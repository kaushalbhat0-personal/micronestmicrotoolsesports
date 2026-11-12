/**
 * League of Legends discovery via the official patch-notes listing page.
 *
 * The listing holds patch cards (`league-of-legends-patch-26-20-notes`
 * links with ISO publication dates in `<time dateTime>`). Non-patch
 * game-update articles never match the patch slug pattern and are ignored.
 *
 * DATE ASSOCIATION IS FORWARD-ONLY AND CARD-BOUNDED (audited P1
 * constraint): the page carries hundreds of duplicated/interleaved
 * timestamps, including neighboring patch cards and non-patch articles
 * *before* each link — and non-patch cards interleaved *after* links too.
 * A backward search would misattribute those, and even a forward search
 * must not bleed past the link's own card anchor. The searchable region
 * therefore ends at the anchor's closing tag (clamped to the forward
 * safety bound); dateless cards are SKIPPED — never guessed.
 */

import { validationError } from "@/lib/errors";
import {
  isLoLArticlePath,
  patchSlugToVersion,
  upstreamIdForVersion,
  versionToDatasetKey,
} from "./sources";

export interface LolIndexEntry {
  readonly version: string;
  readonly releasedAt: string;
  readonly upstreamId: number;
  readonly articleUrl: string;
  readonly datasetKey: string;
}

export interface LolDiscovery {
  readonly entries: readonly LolIndexEntry[];
  readonly latest: LolIndexEntry;
}

const PATCH_HREF_PATTERN =
  /href="([^"]*?league-of-legends-patch-(\d+-\d+)-notes\/?)"/gi;

/** Bounded forward window (characters) for the card date search. */
export const LOL_DATE_FORWARD_WINDOW = 2000;

const TIME_DATETIME_PATTERN =
  /<time[^>]*dateTime="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/i;
const BARE_ISO_PATTERN = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/;
const ANCHOR_CLOSE_PATTERN = /<\/a\s*>/gi;

/**
 * End of the searchable card region: the anchor's own closing tag, so the
 * search can never bleed into a following patch/non-patch card. Clamped
 * to the forward safety bound when the card is malformed or huge.
 */
function cardRegionEnd(html: string, index: number): number {
  const hard = index + LOL_DATE_FORWARD_WINDOW;
  ANCHOR_CLOSE_PATTERN.lastIndex = index;
  const close = ANCHOR_CLOSE_PATTERN.exec(html);
  if (close === null || close.index === undefined) return hard;
  return Math.min(close.index, hard);
}

/**
 * First card date strictly AFTER the link and strictly INSIDE the link's
 * own card anchor. Prefers the card's own `<time dateTime>`; falls back
 * to a bare ISO timestamp in the same region. Returns null when absent —
 * the caller skips the card. NEVER searches backwards and NEVER scans
 * past the card boundary (see module docstring).
 */
export function findDateForward(html: string, index: number): string | null {
  const forward = html.slice(index, cardRegionEnd(html, index));
  const timeMatch = TIME_DATETIME_PATTERN.exec(forward);
  if (timeMatch?.[1]) return timeMatch[1];
  const bareMatch = BARE_ISO_PATTERN.exec(forward);
  return bareMatch?.[1] ?? null;
}

/** Parse listing HTML into dated patch entries. Throws 400 AppError when empty. */
export function parseListingHtml(html: string): LolDiscovery {
  if (typeof html !== "string" || html === "") {
    throw validationError("LoL patch index is empty");
  }
  const seen = new Map<string, LolIndexEntry>();
  PATCH_HREF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATCH_HREF_PATTERN.exec(html)) !== null) {
    const href = match[1] ?? "";
    const slug = match[2] ?? "";
    const version = patchSlugToVersion(slug);
    const upstreamId = version !== null ? upstreamIdForVersion(version) : null;
    const datasetKey = version !== null ? versionToDatasetKey(version) : null;
    if (version === null || upstreamId === null || datasetKey === null) continue;
    if (seen.has(version)) continue;
    // Strict article-path guard before accepting the href.
    let pathname: string;
    try {
      const url = new URL(href, "https://www.leagueoflegends.com");
      if (url.protocol !== "https:") continue;
      if (url.hostname !== "www.leagueoflegends.com" && url.hostname !== "leagueoflegends.com") continue;
      pathname = url.pathname;
    } catch {
      continue;
    }
    if (!isLoLArticlePath(pathname)) continue;
    // Forward-only date association; dateless cards are skipped.
    const releasedAt = findDateForward(html, match.index);
    if (releasedAt === null) continue;
    const articleUrl = `https://www.leagueoflegends.com${pathname}`;
    seen.set(version, { version, releasedAt, upstreamId, articleUrl, datasetKey });
  }
  const entries = [...seen.values()].sort((a, b) => a.upstreamId - b.upstreamId);
  if (entries.length === 0) {
    throw validationError("LoL patch index contains no dated patch entries");
  }
  const latest = entries[entries.length - 1];
  if (latest === undefined) throw validationError("LoL patch index contains no dated patch entries");
  return { entries, latest };
}

/** True when the upstream listing holds a patch newer than the stored max id. */
export function hasNewPatch(discovery: LolDiscovery, storedMaxUpstreamId: number | null): boolean {
  if (storedMaxUpstreamId === null) return true;
  return discovery.latest.upstreamId > storedMaxUpstreamId;
}

/** Latest N versions for bounded backfill — discovered, never hardcoded. */
export function latestNPatchVersions(discovery: LolDiscovery, count: number): LolIndexEntry[] {
  return [...discovery.entries].slice(-Math.max(1, count));
}
