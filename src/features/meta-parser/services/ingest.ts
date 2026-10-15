/**
 * Shared Meta-Parser ingestion pipeline.
 *
 * One pipeline for every game adapter:
 *   discover (lightweight index) → diff vs stored → fetch corpus once
 *   → extract → hash → parse → normalize → upsert (idempotent) → report.
 *
 * Revision semantics: same version + same content hash → no-op.
 * Same version + changed hash → revision bump + change replacement.
 * No duplicate logical patches, ever.
 */

import { normalizeEntityName } from "./entity-normalize";
import { isConflictError } from "./conflict";
import type { DiscoveredPatch, MetaParserAdapter } from "../adapters/registry";

export interface StoredGameRow {
  readonly slug: string;
  readonly adapterKey: string;
  readonly isActive: boolean;
}

export interface StoredPatchRow {
  readonly id: string;
  readonly gameSlug: string;
  readonly version: string;
  readonly contentHash: string;
  readonly revision: number;
  readonly upstreamId: number | null;
  /**
   * Publication state. `ingested` = staging/non-public, `complete` =
   * published/readable. Readers only ever see `complete` rows with a real
   * content hash (see repositories/reads.ts).
   */
  readonly status: string;
}

export interface PatchChangeInsert {
  readonly gameSlug: string;
  readonly patchVersion: string;
  readonly stableKey: string;
  readonly entityType: string;
  readonly entityName: string;
  readonly entityNormalized: string;
  readonly entityKey: string | null;
  readonly category: string;
  readonly attribute: string | null;
  readonly oldText: string | null;
  readonly newText: string | null;
  readonly oldNumeric: number | null;
  readonly newNumeric: number | null;
  readonly unit: string | null;
  readonly changeType: string;
  readonly confidence: string;
  readonly description: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Code attached to unique-violation errors from insertPatch (23505 races). */
export { META_PARSER_CONFLICT_CODE } from "./conflict";

/** Persistence boundary — Supabase implementation lives in repositories. */
export interface MetaParserStore {
  getGame(slug: string): Promise<StoredGameRow | null>;
  getPatchByVersion(gameSlug: string, version: string): Promise<StoredPatchRow | null>;
  getMaxUpstreamId(gameSlug: string): Promise<number | null>;
  insertPatch(input: {
    gameSlug: string;
    version: string;
    title: string;
    sourceUrl: string;
    sourcePublishedAt: string | null;
    contentHash: string;
    parserVersion: string;
    adapterVersion: string;
    upstreamCommit: string | null;
    upstreamId: number | null;
  }): Promise<StoredPatchRow>;
  bumpPatchRevision(patchId: string, contentHash: string, revision: number): Promise<void>;
  /**
   * Demote a published patch back to staging (`status = 'ingested'`) before
   * a revision replacement. Readers filter on `complete`, so the subsequent
   * delete → chunked-insert window reads as unavailable, never partial.
   * Idempotent: re-demoting an already-staged row is a no-op state-wise.
   */
  markPatchStaging(patchId: string): Promise<void>;
  replacePatchChanges(patchId: string, changes: readonly PatchChangeInsert[]): Promise<number>;
  /** Exact change-row count for a patch (replacement verification). */
  countPatchChanges(patchId: string): Promise<number>;
  /** Compensation delete for a patch row created before a failed replace. */
  deletePatch(patchId: string): Promise<void>;
  upsertAliases(
    gameSlug: string,
    aliases: readonly { canonical: string; normalized: string }[]
  ): Promise<number>;
}

export interface IngestGameOptions {
  readonly adapter: MetaParserAdapter;
  readonly store: MetaParserStore;
  readonly gameSlug: string;
  /** Bounded backfill: process latest N instead of only the newest. */
  readonly backfillLatestN?: number;
}

export interface PatchIngestOutcome {
  readonly version: string;
  readonly outcome: "inserted" | "unchanged" | "revised" | "failed";
  readonly changeCount: number;
  readonly error?: string;
}

export interface IngestGameReport {
  readonly gameSlug: string;
  readonly attempted: number;
  readonly inserted: number;
  readonly unchanged: number;
  readonly revised: number;
  readonly failed: number;
  readonly outcomes: readonly PatchIngestOutcome[];
  /** Operational observability (no schema change — report + logs only). */
  readonly parserVersion: string;
  readonly adapterVersion: string;
  readonly viaFallback: boolean;
}

/** Ingest new/changed patches for one game. Per-game errors never throw. */
export async function ingestGamePatches(options: IngestGameOptions): Promise<IngestGameReport> {
  const outcomes: PatchIngestOutcome[] = [];
  const fail = (version: string, error: string): void => {
    outcomes.push({ version, outcome: "failed", changeCount: 0, error: error.slice(0, 200) });
  };

  const game = await options.store.getGame(options.gameSlug);
  if (game === null || !game.isActive || game.adapterKey !== options.adapter.adapterKey) {
    return toReport(options, outcomes, false);
  }

  let patches: readonly DiscoveredPatch[];
  try {
    const discovery = await options.adapter.discover();
    patches =
      options.backfillLatestN !== undefined
        ? discovery.patches.slice(-Math.max(1, options.backfillLatestN))
        : [discovery.latest];
  } catch (error) {
    fail("discovery", error instanceof Error ? error.message : "discovery failed");
    return toReport(options, outcomes, false);
  }

  // Fast path: check stored rows before touching the heavy corpus.
  const storedMax = await options.store.getMaxUpstreamId(options.gameSlug);
  const needsWork: DiscoveredPatch[] = [];
  for (const patch of patches) {
    if (storedMax === null || patch.upstreamId > storedMax) {
      needsWork.push(patch);
      continue;
    }
    const existing = await options.store.getPatchByVersion(options.gameSlug, patch.version);
    if (existing === null) needsWork.push(patch);
  }
  // Re-verify stored versions too: upstream content may have changed
  // (revision semantics) even when the index shows nothing new.
  for (const patch of patches) {
    if (!needsWork.includes(patch)) {
      const existing = await options.store.getPatchByVersion(options.gameSlug, patch.version);
      if (existing !== null) needsWork.push(patch);
    }
  }

  if (needsWork.length === 0) return toReport(options, outcomes, false);

  let corpus: { text: string; upstreamCommit: string | null; viaFallback: boolean };
  try {
    const fetched = await options.adapter.fetchCorpus();
    corpus = { text: fetched.text, upstreamCommit: fetched.upstreamCommit, viaFallback: fetched.viaFallback };
  } catch (error) {
    for (const patch of needsWork) fail(patch.version, error instanceof Error ? error.message : "fetch failed");
    return toReport(options, outcomes, false);
  }

  let aliasMap: ReadonlyMap<string, string> = new Map();
  try {
    aliasMap = await options.adapter.fetchAliasMap();
  } catch {
    aliasMap = new Map();
  }

  for (const patch of needsWork) {
    try {
      const outcome = await ingestOnePatch(options, corpus, aliasMap, patch);
      outcomes.push(outcome);
    } catch (error) {
      fail(patch.version, error instanceof Error ? error.message : "patch failed");
    }
  }
  return toReport(options, outcomes, corpus.viaFallback);
}

interface CorpusSnapshot {
  readonly text: string;
  readonly upstreamCommit: string | null;
}

/**
 * Provisional content hash for brand-new patch rows.
 *
 * The row must not become hash-identical to the source block until its
 * complete change set is written and verified. Real block hashes are
 * 64-char hex, so "" can never match — a crashed run always re-enters
 * replacement instead of taking the unchanged path. Never NULL: the
 * column is NOT NULL and queries compare with equality.
 */
export const PROVISIONAL_CONTENT_HASH = "";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shortMessage(error: unknown, max = 90): string {
  const message = errorMessage(error).replace(/\s+/g, " ").trim();
  return message.length > max ? `${message.slice(0, max)}…` : message;
}
/**
 * Ingest a single patch with convergence + compensation semantics.
 *
 * - Same hash as stored → unchanged (zero writes).
 * - Changed hash → verified replace, hash/revision advance ONLY on success.
 * - Unique-violation on insert (concurrent winner) → re-read and converge:
 *   same content → unchanged; different content → revise in place.
 * - New rows are inserted with a provisional hash and promoted to the real
 *   hash only after verification, so a double failure (replace + delete
 *   both fail) still retries instead of reporting a false unchanged.
 */
async function ingestOnePatch(
  options: IngestGameOptions,
  corpus: CorpusSnapshot,
  aliasMap: ReadonlyMap<string, string>,
  patch: DiscoveredPatch
): Promise<PatchIngestOutcome> {
  const { block, blockHash } = options.adapter.extractPatchBlock(corpus.text, patch.datasetKey);
  const existing = await options.store.getPatchByVersion(options.gameSlug, patch.version);
  if (existing !== null && existing.contentHash === blockHash) {
    return { version: patch.version, outcome: "unchanged", changeCount: 0 };
  }

  const raw = options.adapter.parseBlock(block, { upstreamCommit: corpus.upstreamCommit, aliasMap });
  const changes: PatchChangeInsert[] = raw.map((change) => ({
    gameSlug: options.gameSlug,
    patchVersion: patch.version,
    stableKey: change.stableKey,
    entityType: change.entityType,
    entityName: change.entityName,
    entityNormalized: normalizeEntityName(change.entityName),
    entityKey: change.entityKey,
    category: change.category,
    attribute: change.attribute,
    oldText: change.oldText,
    newText: change.newText,
    oldNumeric: change.oldNumeric,
    newNumeric: change.newNumeric,
    unit: change.unit,
    changeType: change.changeType,
    confidence: change.confidence,
    description: change.description,
    metadata: change.metadata,
  }));

  if (existing !== null) {
    await promoteExisting(options, existing, blockHash, changes);
    return { version: patch.version, outcome: "revised", changeCount: changes.length };
  }

  let inserted: StoredPatchRow;
  try {
    inserted = await options.store.insertPatch({
      gameSlug: options.gameSlug,
      version: patch.version,
      title: `${options.gameSlug} ${patch.version}`,
      sourceUrl: options.adapter.sourceUrlFor(patch.version),
      sourcePublishedAt: patch.releasedAt,
      // Provisional: the real hash becomes authoritative only after the
      // change set below is verified complete (see promotion step).
      contentHash: PROVISIONAL_CONTENT_HASH,
      parserVersion: options.adapter.parserVersion,
      adapterVersion: options.adapter.adapterVersion,
      upstreamCommit: corpus.upstreamCommit,
      upstreamId: patch.upstreamId,
    });
  } catch (error) {
    // Concurrent winner created the logical patch first: converge instead
    // of reporting a false failure — but only when the existing row is
    // demonstrably the same logical patch (same game + version).
    if (!isConflictError(error)) throw error;
    const winner = await options.store.getPatchByVersion(options.gameSlug, patch.version);
    if (winner === null) throw error;
    if (winner.contentHash === blockHash) {
      return { version: patch.version, outcome: "unchanged", changeCount: 0 };
    }
    await promoteExisting(options, winner, blockHash, changes);
    return { version: patch.version, outcome: "revised", changeCount: changes.length };
  }

  try {
    await replaceAndVerify(options, inserted.id, changes);
    await seedHeroAliases(options, changes);
  } catch (replaceError) {
    // Compensation is belt-and-braces: attempt the delete, but correctness
    // no longer depends on it — the provisional hash forces retry either
    // way. Both causes are preserved; success is never reported here.
    try {
      await options.store.deletePatch(inserted.id);
    } catch (compensationError) {
      throw new Error(
        `Replacement failed (${shortMessage(replaceError)}); compensation failed (${shortMessage(compensationError)})`
      );
    }
    throw replaceError;
  }
  // Promotion: the complete set verified, so the real hash is now authoritative.
  await options.store.bumpPatchRevision(inserted.id, blockHash, inserted.revision);
  return { version: patch.version, outcome: "inserted", changeCount: changes.length };
}

/**
 * Promote an existing row to new content: demote to staging first, then
 * verified replace, then aliases, then hash/revision + publication — never
 * before. A row still carrying the provisional hash never completed a
 * promotion, so it keeps its revision instead of skipping a number.
 * A failure after demotion leaves `status = 'ingested'` (non-public); the
 * next run retries because the stored hash still differs from the block hash.
 */
async function promoteExisting(
  options: IngestGameOptions,
  existing: StoredPatchRow,
  blockHash: string,
  changes: readonly PatchChangeInsert[]
): Promise<void> {
  await options.store.markPatchStaging(existing.id);
  await replaceAndVerify(options, existing.id, changes);
  await seedHeroAliases(options, changes);
  const nextRevision =
    existing.contentHash === PROVISIONAL_CONTENT_HASH ? existing.revision : existing.revision + 1;
  await options.store.bumpPatchRevision(existing.id, blockHash, nextRevision);
}
async function replaceAndVerify(
  options: IngestGameOptions,
  patchId: string,
  changes: readonly PatchChangeInsert[]
): Promise<void> {
  await options.store.replacePatchChanges(patchId, changes);
  const stored = await options.store.countPatchChanges(patchId);
  if (stored !== changes.length) {
    throw new Error(
      `Change replacement incomplete for patch ${patchId}: expected ${changes.length}, stored ${stored}`
    );
  }
}

async function seedHeroAliases(
  options: IngestGameOptions,
  changes: readonly PatchChangeInsert[]
): Promise<void> {
  const seen = new Map<string, string>();
  for (const change of changes) {
    if (change.entityType === "hero" && !seen.has(change.entityNormalized)) {
      seen.set(change.entityNormalized, change.entityName);
    }
  }
  await options.store.upsertAliases(
    options.gameSlug,
    [...seen].map(([normalized, canonical]) => ({ canonical, normalized }))
  );
}

function toReport(options: IngestGameOptions, outcomes: PatchIngestOutcome[], viaFallback: boolean): IngestGameReport {
  const count = (outcome: PatchIngestOutcome["outcome"]): number =>
    outcomes.filter((entry) => entry.outcome === outcome).length;
  return {
    gameSlug: options.gameSlug,
    attempted: outcomes.length,
    inserted: count("inserted"),
    unchanged: count("unchanged"),
    revised: count("revised"),
    failed: count("failed"),
    outcomes,
    parserVersion: options.adapter.parserVersion,
    adapterVersion: options.adapter.adapterVersion,
    viaFallback,
  };
}
