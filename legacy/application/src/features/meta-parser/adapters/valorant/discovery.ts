/**
 * VALORANT discovery via the official patch-notes listing page.
 *
 * The listing holds patch cards (`valorant-patch-notes-13-08` links with
 * ISO publication dates). Non-patch game-update articles (skin reveals,
 * trailers) never match the patch slug pattern and are ignored.
 */

import { validationError } from "@/lib/errors";
import { patchSlugToVersion, upstreamIdForVersion, versionToDatasetKey } from "./sources";

export interface ValorantIndexEntry {
  readonly version: string;
  readonly releasedAt: string;
  readonly upstreamId: number;
  readonly articleUrl: string;
  readonly datasetKey: string;
}

export interface ValorantDiscovery {
  readonly entries: readonly ValorantIndexEntry[];
  readonly latest: ValorantIndexEntry;
}

const PATCH_HREF_PATTERN =
  /href="([^"]*?valorant-patch-notes-(\d+-\d+)\/?)"/gi;

function findDateNear(html: string, index: number): string | null {
  // Card layout places the date after the link (link → artwork → date →
  // title), so prefer the forward window and only fall back backwards.
  const forward = html.slice(index, index + 1500);
  const forwardMatch = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/.exec(forward);
  if (forwardMatch?.[1]) return forwardMatch[1];
  const backward = html.slice(Math.max(0, index - 1500), index);
  const backwardMatches = [...backward.matchAll(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/g)];
  const last = backwardMatches[backwardMatches.length - 1]?.[1];
  return last ?? null;
}

/** Parse listing HTML into dated patch entries. Throws 400 AppError when empty. */
export function parseListingHtml(html: string): ValorantDiscovery {
  if (typeof html !== "string" || html === "") {
    throw validationError("VALORANT patch index is empty");
  }
  const seen = new Map<string, ValorantIndexEntry>();
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
    const releasedAt = findDateNear(html, match.index);
    if (releasedAt === null) continue;
    const articleUrl = href.startsWith("http")
      ? href
      : `https://playvalorant.com${href.startsWith("/") ? href : `/${href}`}`;
    seen.set(version, { version, releasedAt, upstreamId, articleUrl, datasetKey });
  }
  const entries = [...seen.values()].sort((a, b) => a.upstreamId - b.upstreamId);
  if (entries.length === 0) {
    throw validationError("VALORANT patch index contains no dated patch entries");
  }
  const latest = entries[entries.length - 1];
  if (latest === undefined) throw validationError("VALORANT patch index contains no dated patch entries");
  return { entries, latest };
}

/** True when the upstream listing holds a patch newer than the stored max id. */
export function hasNewPatch(discovery: ValorantDiscovery, storedMaxUpstreamId: number | null): boolean {
  if (storedMaxUpstreamId === null) return true;
  return discovery.latest.upstreamId > storedMaxUpstreamId;
}

/** Latest N versions for bounded backfill — discovered, never hardcoded. */
export function latestNPatchVersions(discovery: ValorantDiscovery, count: number): ValorantIndexEntry[] {
  return [...discovery.entries].slice(-Math.max(1, count));
}
