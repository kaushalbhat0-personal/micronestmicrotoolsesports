/**
 * Game adapter registry — one entry point for every Meta-Parser game.
 *
 * Rules:
 * - Adapters implement `MetaParserAdapter`; the shared ingest pipeline only
 *   speaks this interface (no per-game routes, crons, or tables).
 * - Adding a game = new adapter module + `registerAdapter` call + games
 *   catalog row. MLBB stays unregistered until its audit gates clear.
 */

import type { RawPatchChange } from "../types";

export interface DiscoveredPatch {
  readonly version: string;
  readonly releasedAt: string;
  readonly upstreamId: number;
  readonly datasetKey: string;
}

export interface CorpusFetch {
  readonly text: string;
  readonly upstreamCommit: string | null;
  readonly viaFallback: boolean;
}

export interface MetaParserAdapter {
  readonly adapterKey: string;
  readonly gameSlug: string;
  /** Version strings threaded into patch rows, logs, and reports. */
  readonly parserVersion: string;
  readonly adapterVersion: string;
  discover(): Promise<{ patches: readonly DiscoveredPatch[]; latest: DiscoveredPatch }>;
  fetchCorpus(): Promise<CorpusFetch>;
  fetchAliasMap(): Promise<ReadonlyMap<string, string>>;
  extractPatchBlock(
    corpusText: string,
    datasetKey: string
  ): { block: unknown; blockHash: string };
  parseBlock(
    block: unknown,
    opts: { upstreamCommit: string | null; aliasMap: ReadonlyMap<string, string> }
  ): RawPatchChange[];
  sourceUrlFor(version: string): string;
}

const REGISTRY = new Map<string, MetaParserAdapter>();

/** Register an adapter (called once per adapter module from its index). */
export function registerAdapter(adapter: MetaParserAdapter): void {
  REGISTRY.set(adapter.adapterKey, adapter);
}

/** Resolve an adapter by key. Returns undefined for unknown/unregistered games. */
export function getAdapter(adapterKey: string): MetaParserAdapter | undefined {
  return REGISTRY.get(adapterKey);
}

/** Adapter keys currently registered (for diagnostics, never auth). */
export function registeredAdapterKeys(): string[] {
  return [...REGISTRY.keys()];
}

/** Test-only reset. Never call in production code. */
export function clearAdapterRegistry(): void {
  REGISTRY.clear();
}
