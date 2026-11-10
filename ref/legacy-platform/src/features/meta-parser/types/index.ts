/**
 * Meta-Parser shared types — multi-game patch intelligence engine.
 *
 * Boundaries:
 * - Game adapters produce `RawPatchChange`; the shared pipeline normalizes
 *   them into `NormalizedPatchChange` (mirrors `meta_parser_changes` rows).
 * - No per-game tables, routes, or crons. One ingestion route, one scheduler,
 *   one normalized schema, many adapters.
 * - The LLM never participates in classification (`classificationSource` is
 *   always "deterministic").
 */

export type MetaParserGameSlug = string;

export type PatchChangeType =
  | "buff"
  | "nerf"
  | "adjustment"
  | "rework"
  | "new"
  | "bugfix"
  | "neutral";

export type ClassificationConfidence = "high" | "medium" | "low";

/** Raw change emitted by a game adapter before normalization. */
export interface RawPatchChange {
  /** Stable key within the patch, e.g. "hero:alchemist:alchemist_chemical_rage:0". */
  readonly stableKey: string;
  readonly entityType: string;
  readonly entityName: string;
  /** Adapter-known key, e.g. Dota hero_key "rattletrap". */
  readonly entityKey: string | null;
  readonly category: string;
  readonly attribute: string | null;
  /** Plain-text description (already sanitized by the adapter). */
  readonly description: string;
  readonly oldText: string | null;
  readonly newText: string | null;
  readonly oldNumeric: number | null;
  readonly newNumeric: number | null;
  readonly unit: string | null;
  readonly changeType: PatchChangeType;
  readonly confidence: ClassificationConfidence;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Normalized change ready for `meta_parser_changes` persistence. */
export interface NormalizedPatchChange extends RawPatchChange {
  readonly gameSlug: string;
  readonly patchVersion: string;
  readonly entityNormalized: string;
}

/** Minimal patch-release shape mirrored from `meta_parser_patches`. */
export interface MetaParserPatchRelease {
  readonly id: string;
  readonly gameSlug: string;
  readonly patchVersion: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly sourcePublishedAt: string | null;
  readonly contentHash: string;
  readonly revision: number;
  readonly status: string;
  readonly parserVersion: string;
  readonly adapterVersion: string;
  readonly upstreamCommit: string | null;
}

/** What the adapter registry resolves per game. */
export interface GameAdapterDefinition {
  readonly adapterKey: string;
  readonly gameSlug: string;
  readonly versionScheme: string;
  readonly allowedHosts: readonly string[];
}
