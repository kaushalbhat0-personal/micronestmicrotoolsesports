/**
 * Dota 2 discovery via the lightweight patch.json version/date index.
 *
 * The 2.6 MB patchnotes corpus is only downloaded when this index proves
 * a new patch exists (stored max id < upstream max id).
 */

import { z } from "zod";
import { validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { datasetKeyToVersion, versionToDatasetKey } from "./sources";

const patchIndexEntrySchema = z.object({
  name: z.string().min(1).max(20),
  date: z.string().datetime({ offset: true }),
  id: z.number().int().min(0),
});

const patchIndexSchema = z.array(patchIndexEntrySchema).min(1);

export interface PatchIndexEntry {
  readonly version: string;
  readonly releasedAt: string;
  readonly upstreamId: number;
}

export interface PatchDiscovery {
  readonly entries: readonly PatchIndexEntry[];
  readonly latest: PatchIndexEntry;
}

/** Parse and validate patch.json. Throws 400 AppError on malformed input. */
export function parsePatchIndex(raw: unknown): PatchDiscovery {
  const rows = parseOrThrow(patchIndexSchema, raw);
  const entries: PatchIndexEntry[] = [];
  for (const row of rows) {
    if (versionToDatasetKey(row.name) === null) continue;
    entries.push({ version: row.name, releasedAt: row.date, upstreamId: row.id });
  }
  if (entries.length === 0) throw validationError("Patch index contains no valid versions");
  entries.sort((a, b) => a.upstreamId - b.upstreamId);
  const latest = entries[entries.length - 1];
  if (latest === undefined) throw validationError("Patch index contains no valid versions");
  return { entries, latest };
}

/** True when the upstream index holds a patch newer than the stored max id. */
export function hasNewPatch(discovery: PatchDiscovery, storedMaxUpstreamId: number | null): boolean {
  if (storedMaxUpstreamId === null) return true;
  return discovery.latest.upstreamId > storedMaxUpstreamId;
}

/** Latest N versions for bounded backfill — discovered, never hardcoded. */
export function latestNPatchVersions(discovery: PatchDiscovery, count: number): PatchIndexEntry[] {
  return discovery.entries.slice(-Math.max(1, count));
}

/** Dataset key ("7_41") for a display version ("7.41"). Null when invalid. */
export function datasetKeyForVersion(version: string): string | null {
  return versionToDatasetKey(version);
}

export function versionForDatasetKey(key: string): string | null {
  return datasetKeyToVersion(key);
}
