/**
 * Meta-Parser Facts read repository (server-only).
 *
 * The ONLY production Facts read path. Used by the future public and
 * workspace Facts UI through the normal server Supabase client (anon key,
 * RLS-enforced) — never the service-role admin client, never from client
 * components. The global catalog is intentionally not organization-scoped.
 *
 * Publication invariant (Option C): every patch query enforces
 *   status = 'complete' AND content_hash <> ''
 * and every change query is gated on its patch satisfying the same
 * predicate. Staging (`ingested`), failed, and provisional-hash rows are
 * invisible here by construction — a reader during ingestion observes
 * unavailable, never empty/partial data.
 *
 * Ordering is `stable_key` ascending: deterministic but not semantic
 * (no ordinal column in V1 by design).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import { normalizeEntityName } from "../services/entity-normalize";

/** Patch rows with this status are publicly readable. */
export const META_PARSER_PUBLISHED_STATUS = "complete" as const;
/** Patch rows with this status are staging (ingesting/replacing). */
export const META_PARSER_STAGING_STATUS = "ingested" as const;

export const META_PARSER_READ_DEFAULT_LIMIT = 50;
export const META_PARSER_READ_MAX_LIMIT = 100;

/**
 * Entity groups per grouped-facts page (RCCF-META-PARSER-UX-07). A page
 * represents N entity groups — never N change rows — so groups stay atomic
 * and per-group counts remain patch-global and truthful.
 */
export const META_PARSER_GROUPED_GROUPS_PER_PAGE = 15;
/** Upper bound for grouped pagination (groups, not rows). */
export const META_PARSER_GROUPED_MAX_GROUPS = 50;

const GAME_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Safe generic version identifier (game-agnostic).
 *
 * Contract: 1–40 chars, `[A-Za-z0-9._-]`, starts alphanumeric, contains at
 * least one digit. Accepts 7.41, 14.10, 10.08, EP09, 2.2.16a, 2026-03-12,
 * Y10S1.1 while rejecting path traversal, spaces, slashes, and bare words
 * like "seven". Source-specific semantics stay in the adapter/catalog
 * (`meta_parser_games.version_scheme`); this is only a transport guard.
 */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const VERSION_MAX_LENGTH = 40;

function isGenericVersion(value: string): boolean {
  if (value.length === 0 || value.length > VERSION_MAX_LENGTH) return false;
  if (!VERSION_PATTERN.test(value)) return false;
  return /\d/.test(value);
}

/** Shared URL-shape guard; the read repository remains the source of truth. */
export function isGenericPatchVersion(value: string): boolean {
  return isGenericVersion(value);
}

/**
 * Safe generic entity-type identifier (game-agnostic).
 *
 * Adapters introduce new types (hero, champion, agent, operator, weapon,
 * map, legend, ability, character, system, item, ...) without shared-code
 * changes. The repository validates shape only; it never allowlists values.
 */
const ENTITY_TYPE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ENTITY_TYPE_MAX_LENGTH = 40;

function isGenericEntityType(value: string): boolean {
  if (value.length === 0 || value.length > ENTITY_TYPE_MAX_LENGTH) return false;
  return ENTITY_TYPE_PATTERN.test(value);
}

/** Shared entity-type shape guard for filters and UI. */
export function isGenericEntityTypeValue(value: string): boolean {
  return isGenericEntityType(value);
}

const READABLE_CHANGE_TYPES = ["buff", "nerf", "adjustment", "rework", "new", "bugfix", "neutral"] as const;

/** Entity types are open vocabulary (adapter-defined); change types are closed. */
export type ReadableEntityType = string;
export type ReadableChangeType = (typeof READABLE_CHANGE_TYPES)[number];

/**
 * Data-driven game provenance parsed from
 * `meta_parser_games.expected_fields.provenance` (JSONB, no migration).
 * All fields nullable: absent catalog metadata yields nulls and the UI
 * applies presentation fallbacks. No game literals live here.
 */
export interface PublishedGameProvenance {
  readonly sourceLabel: string | null;
  readonly datasetLabel: string | null;
  readonly datasetUrl: string | null;
  readonly license: string | null;
}

/** Public-safe game projection (no catalog internals). */
export interface PublishedGame {
  readonly slug: string;
  readonly name: string;
  readonly provenance: PublishedGameProvenance;
}

/**
 * Public-safe patch projection. Internal ingestion metadata
 * (upstream_commit, upstream_id, parser/adapter versions, cron internals,
 * provisional hash state) is deliberately excluded.
 */
export interface PublishedPatch {
  readonly id: string;
  readonly gameSlug: string;
  readonly patchVersion: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly sourcePublishedAt: string | null;
  readonly revision: number;
}

/** Patch header with its exact total change count (one cheap indexed count). */
export interface PublishedPatchHeader extends PublishedPatch {
  readonly changeCount: number;
}

/** Public-safe change projection (no `metadata` — carries upstream internals). */
export interface PublishedChange {
  readonly id: string;
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
}

export interface ListChangesFilters {
  readonly entityType?: string;
  readonly changeType?: string;
  /** Free-form entity text; normalized server-side before comparison. */
  readonly entityNormalized?: string;
}

export interface ListChangesPagination {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListChangesResult {
  /** False when the patch is missing, staging, or provisional: no rows leak. */
  readonly published: boolean;
  readonly changes: readonly PublishedChange[];
  readonly limit: number;
  readonly offset: number;
  /** True when another page exists. Computed without an exact count. */
  readonly hasMore: boolean;
}

/**
 * Stored-classification counts for one entity group. Pure folds over the
 * stored `change_type` values — never re-derived from polarity, text, or
 * confidence. `adjustment` is a heterogeneous bucket (genuine tweaks,
 * unknown polarity, contradictory signals); the UI reports it as
 * "Adjustments" and nothing more specific.
 */
export interface PublishedChangeCounts {
  readonly total: number;
  readonly buff: number;
  readonly nerf: number;
  readonly adjustment: number;
  readonly rework: number;
  readonly new: number;
  readonly bugfix: number;
  readonly neutral: number;
}

/**
 * One entity group: every published change sharing the canonical
 * `(entity_type, entity_normalized)` key, in `stable_key` order.
 * Display name comes from the first row (deterministic); `category` and
 * `entityKey` never split groups.
 */
export interface PublishedEntityGroup {
  readonly entityType: string;
  readonly entityName: string;
  readonly entityNormalized: string;
  readonly changes: readonly PublishedChange[];
  readonly counts: PublishedChangeCounts;
}

export interface ListGroupedChangesPagination {
  readonly groupLimit?: number;
  readonly groupOffset?: number;
}

export interface ListGroupedChangesResult {
  /** False when the patch is missing, staging, or provisional: no rows leak. */
  readonly published: boolean;
  /** The requested page slice of whole entity groups (never split). */
  readonly groups: readonly PublishedEntityGroup[];
  readonly groupLimit: number;
  readonly groupOffset: number;
  /** Total entity groups in the filtered set (for pagination). */
  readonly groupTotal: number;
  /** Total changes in the filtered set (for status labels). */
  readonly changeTotal: number;
  /**
   * Patch-global per-entity-type totals over the filtered set, so section
   * headers stay truthful across group pages. Generic stored values only —
   * section mapping stays in the presentation taxonomy.
   */
  readonly entityTypeTotals: Readonly<
    Record<string, { readonly groups: number; readonly changes: number }>
  >;
  /** True when another group page exists. */
  readonly hasMore: boolean;
}

function assertGameSlug(gameSlug: string): void {
  if (!GAME_SLUG_PATTERN.test(gameSlug)) {
    throw validationError(`Invalid game slug: ${gameSlug}`);
  }
}

function assertVersion(patchVersion: string): void {
  if (!isGenericVersion(patchVersion)) {
    throw validationError(`Invalid patch version: ${patchVersion}`);
  }
}

function assertPatchId(patchId: string): void {
  if (typeof patchId !== "string" || patchId.length === 0 || patchId.length > 120) {
    throw validationError("Invalid patch id");
  }
}

function assertFilters(filters: ListChangesFilters): {
  entityType: ReadableEntityType | null;
  changeType: ReadableChangeType | null;
  entityNormalized: string | null;
} {
  let entityType: ReadableEntityType | null = null;
  if (filters.entityType !== undefined) {
    if (!isGenericEntityType(filters.entityType)) {
      throw validationError(`Invalid entity_type: ${filters.entityType}`);
    }
    entityType = filters.entityType;
  }
  let changeType: ReadableChangeType | null = null;
  if (filters.changeType !== undefined) {
    if (!(READABLE_CHANGE_TYPES as readonly string[]).includes(filters.changeType)) {
      throw validationError(`Invalid change_type: ${filters.changeType}`);
    }
    changeType = filters.changeType as ReadableChangeType;
  }
  let entityNormalized: string | null = null;
  if (filters.entityNormalized !== undefined) {
    entityNormalized = normalizeEntityName(filters.entityNormalized);
    if (entityNormalized === "") throw validationError("Invalid entity filter");
  }
  return { entityType, changeType, entityNormalized };
}

function clampPagination(pagination: ListChangesPagination): { limit: number; offset: number } {
  const rawLimit = pagination.limit ?? META_PARSER_READ_DEFAULT_LIMIT;
  const limit = !Number.isInteger(rawLimit)
    ? META_PARSER_READ_DEFAULT_LIMIT
    : Math.min(Math.max(rawLimit, 1), META_PARSER_READ_MAX_LIMIT);
  const rawOffset = pagination.offset ?? 0;
  const offset = !Number.isInteger(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  return { limit, offset };
}

const PATCH_COLUMNS =
  "id, game_slug, patch_version, title, source_url, source_published_at, revision";
const CHANGE_COLUMNS =
  "id, entity_type, entity_name, entity_normalized, entity_key, category, attribute, old_text, new_text, old_numeric, new_numeric, unit, change_type, confidence, description";

function toPublishedPatch(row: {
  id: string;
  game_slug: string;
  patch_version: string;
  title: string;
  source_url: string;
  source_published_at: string | null;
  revision: number;
}): PublishedPatch {
  return {
    id: row.id,
    gameSlug: row.game_slug,
    patchVersion: row.patch_version,
    title: row.title,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    revision: row.revision,
  };
}

function toPublishedChange(row: {
  id: string;
  entity_type: string;
  entity_name: string;
  entity_normalized: string;
  entity_key: string | null;
  category: string;
  attribute: string | null;
  old_text: string | null;
  new_text: string | null;
  old_numeric: number | null;
  new_numeric: number | null;
  unit: string | null;
  change_type: string;
  confidence: string;
  description: string;
}): PublishedChange {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityName: row.entity_name,
    entityNormalized: row.entity_normalized,
    entityKey: row.entity_key,
    category: row.category,
    attribute: row.attribute,
    oldText: row.old_text,
    newText: row.new_text,
    oldNumeric: row.old_numeric,
    newNumeric: row.new_numeric,
    unit: row.unit,
    changeType: row.change_type,
    confidence: row.confidence,
    description: row.description,
  };
}

/** Coerce one provenance string field (bounded, no markup). Null when absent. */
function provenanceField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, 200);
}

/** Parse `expected_fields.provenance` generically — never game-specific. */
function toPublishedProvenance(expectedFields: unknown): PublishedGameProvenance {
  if (typeof expectedFields !== "object" || expectedFields === null || Array.isArray(expectedFields)) {
    return { sourceLabel: null, datasetLabel: null, datasetUrl: null, license: null };
  }
  const provenance = (expectedFields as Record<string, unknown>)["provenance"];
  if (typeof provenance !== "object" || provenance === null || Array.isArray(provenance)) {
    return { sourceLabel: null, datasetLabel: null, datasetUrl: null, license: null };
  }
  const record = provenance as Record<string, unknown>;
  return {
    sourceLabel: provenanceField(record["sourceLabel"]),
    datasetLabel: provenanceField(record["datasetLabel"]),
    datasetUrl: provenanceField(record["datasetUrl"]),
    license: provenanceField(record["license"]),
  };
}

/** Active games only — unregistered/inactive games are never readable. */
export async function listGames(supabase: SupabaseClient): Promise<readonly PublishedGame[]> {
  const { data, error } = await supabase
    .from("meta_parser_games")
    .select("slug, name, expected_fields")
    .eq("is_active", true)
    .order("slug", { ascending: true });
  if (error) throw new Error(`Failed to list games: ${error.message}`);
  return ((data ?? []) as Array<{ slug: string; name: string; expected_fields?: unknown }>).map(
    (row) => ({
      slug: row.slug,
      name: row.name,
      provenance: toPublishedProvenance(row.expected_fields),
    })
  );
}

/** Published patches for a game, newest first. No per-patch counts (N+1). */
export async function listPatches(
  supabase: SupabaseClient,
  gameSlug: string
): Promise<readonly PublishedPatch[]> {
  assertGameSlug(gameSlug);
  const { data: game, error: gameError } = await supabase
    .from("meta_parser_games")
    .select("slug")
    .eq("slug", gameSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (gameError) throw new Error(`Failed to load game: ${gameError.message}`);
  if (!game) return [];
  const { data, error } = await supabase
    .from("meta_parser_patches")
    .select(PATCH_COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("status", META_PARSER_PUBLISHED_STATUS)
    .neq("content_hash", "")
    .order("source_published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to list patches: ${error.message}`);
  return ((data ?? []) as Array<Parameters<typeof toPublishedPatch>[0]>).map(toPublishedPatch);
}

/** Published patch header + exact total. Null when missing/staging/provisional. */
export async function getPatch(
  supabase: SupabaseClient,
  gameSlug: string,
  patchVersion: string
): Promise<PublishedPatchHeader | null> {
  assertGameSlug(gameSlug);
  assertVersion(patchVersion);
  const { data, error } = await supabase
    .from("meta_parser_patches")
    .select(PATCH_COLUMNS)
    .eq("game_slug", gameSlug)
    .eq("patch_version", patchVersion)
    .eq("status", META_PARSER_PUBLISHED_STATUS)
    .neq("content_hash", "")
    .maybeSingle();
  if (error) throw new Error(`Failed to load patch: ${error.message}`);
  if (!data) return null;
  const patch = toPublishedPatch(data as Parameters<typeof toPublishedPatch>[0]);
  const { count, error: countError } = await supabase
    .from("meta_parser_changes")
    .select("id", { count: "exact", head: true })
    .eq("patch_id", patch.id);
  if (countError) throw new Error(`Failed to count patch changes: ${countError.message}`);
  return { ...patch, changeCount: count ?? 0 };
}

/**
 * Publication gate shared by patch-scoped change readers: staging, failed,
 * provisional-hash, or missing patches are never readable.
 */
async function isPatchPublished(supabase: SupabaseClient, patchId: string): Promise<boolean> {
  const { data: gate, error: gateError } = await supabase
    .from("meta_parser_patches")
    .select("id")
    .eq("id", patchId)
    .eq("status", META_PARSER_PUBLISHED_STATUS)
    .neq("content_hash", "")
    .maybeSingle();
  if (gateError) throw new Error(`Failed to verify patch publication: ${gateError.message}`);
  if (!gate) return false;
  return true;
}

/**
 * Distinct entity types recorded for a published patch (Category filter UI).
 * Sorted ascending; empty when the patch is missing, staging, or
 * provisional. Same anon RLS client and gate as `listChanges` — no new
 * data layer, no service-role access.
 *
 * Bounded distinct scan (UX-11): the select is chunked in stable
 * `entity_type` order and folded server-side, so large patches (beyond the
 * PostgREST default response cap) still disclose every type instead of only
 * the types present in the first response window. Single-column rows only;
 * the browser receives just the distinct list.
 */
export async function listPatchEntityTypes(
  supabase: SupabaseClient,
  patchId: string
): Promise<readonly string[]> {
  assertPatchId(patchId);
  if (!(await isPatchPublished(supabase, patchId))) return [];
  const types = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("meta_parser_changes")
      .select("entity_type")
      .eq("patch_id", patchId)
      .order("entity_type", { ascending: true })
      .range(offset, offset + ENTITY_TYPE_SCAN_CHUNK - 1);
    if (error) throw new Error(`Failed to list patch entity types: ${error.message}`);
    const rows = (data ?? []) as Array<{ entity_type: unknown }>;
    for (const row of rows) {
      if (typeof row.entity_type === "string" && row.entity_type !== "") {
        types.add(row.entity_type);
      }
    }
    offset += rows.length;
    if (rows.length < ENTITY_TYPE_SCAN_CHUNK) break;
  }
  return [...types].sort();
}

/** Cap for entity-name suggestions (Search datalist). Bounded by design. */
export const META_PARSER_ENTITY_SUGGESTION_LIMIT = 200;

/**
 * Distinct entity names recorded for a published patch (Search suggestions).
 * Alphabetical, capped, empty when unpublished. Suggestions only — the
 * free-form `entity` filter itself is unchanged.
 */
export async function listPatchEntityNames(
  supabase: SupabaseClient,
  patchId: string,
  limit: number = META_PARSER_ENTITY_SUGGESTION_LIMIT
): Promise<readonly string[]> {
  assertPatchId(patchId);
  if (!(await isPatchPublished(supabase, patchId))) return [];
  const { data, error } = await supabase
    .from("meta_parser_changes")
    .select("entity_name")
    .eq("patch_id", patchId)
    .order("entity_name", { ascending: true })
    .range(0, 1999);
  if (error) throw new Error(`Failed to list patch entity names: ${error.message}`);
  const values = ((data ?? []) as Array<{ entity_name: unknown }>)
    .map((row) => row.entity_name)
    .filter((value): value is string => typeof value === "string" && value !== "");
  return [...new Set(values)].slice(0, Math.max(1, limit));
}

/**
 * Paginated changes for a patch. The patch gate runs first: staging,
 * failed, provisional, or missing patches yield `published: false` with no
 * rows — partial change sets can never leak through this path.
 * `hasMore` is derived from a limit+1 fetch; no exact filtered counts.
 */
export async function listChanges(
  supabase: SupabaseClient,
  patchId: string,
  filters: ListChangesFilters = {},
  pagination: ListChangesPagination = {}
): Promise<ListChangesResult> {
  assertPatchId(patchId);
  const { entityType, changeType, entityNormalized } = assertFilters(filters);
  const { limit, offset } = clampPagination(pagination);

  if (!(await isPatchPublished(supabase, patchId))) {
    return { published: false, changes: [], limit, offset, hasMore: false };
  }

  let query = supabase.from("meta_parser_changes").select(CHANGE_COLUMNS).eq("patch_id", patchId);
  if (entityType !== null) query = query.eq("entity_type", entityType);
  if (changeType !== null) query = query.eq("change_type", changeType);
  if (entityNormalized !== null) query = query.eq("entity_normalized", entityNormalized);
  // range() is inclusive on both ends: fetch one extra row to detect hasMore.
  const { data, error } = await query
    .order("stable_key", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`Failed to list changes: ${error.message}`);
  const rows = (data ?? []) as Array<Parameters<typeof toPublishedChange>[0]>;
  const hasMore = rows.length > limit;
  return {
    published: true,
    changes: rows.slice(0, limit).map(toPublishedChange),
    limit,
    offset,
    hasMore,
  };
}

function emptyChangeCounts(): Record<keyof PublishedChangeCounts, number> {
  return {
    total: 0,
    buff: 0,
    nerf: 0,
    adjustment: 0,
    rework: 0,
    new: 0,
    bugfix: 0,
    neutral: 0,
  };
}

/**
 * Pure entity-group fold (RCCF-META-PARSER-UX-07). Groups by the canonical
 * `(entity_type, entity_normalized)` key in input order — callers pass
 * `stable_key`-ordered rows so groups emerge in first-stable_key order with
 * rows ordered within. Display names, categories, and entity keys never
 * affect grouping. Counts fold stored `change_type` values only.
 */
export function groupPublishedChanges(
  changes: readonly PublishedChange[]
): PublishedEntityGroup[] {
  interface MutableGroup {
    entityType: string;
    entityName: string;
    entityNormalized: string;
    changes: PublishedChange[];
    counts: Record<keyof PublishedChangeCounts, number>;
  }
  const groups: MutableGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const change of changes) {
    const key = `${change.entityType}|\u0000|${change.entityNormalized}`;
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = groups.length;
      indexByKey.set(key, index);
      groups.push({
        entityType: change.entityType,
        entityName: change.entityName,
        entityNormalized: change.entityNormalized,
        changes: [],
        counts: emptyChangeCounts(),
      });
    }
    const group = groups[index] as MutableGroup;
    group.changes.push(change);
    group.counts.total += 1;
    if (
      change.changeType === "buff" ||
      change.changeType === "nerf" ||
      change.changeType === "adjustment" ||
      change.changeType === "rework" ||
      change.changeType === "new" ||
      change.changeType === "bugfix" ||
      change.changeType === "neutral"
    ) {
      group.counts[change.changeType] += 1;
    }
  }
  return groups.map((group) => ({
    entityType: group.entityType,
    entityName: group.entityName,
    entityNormalized: group.entityNormalized,
    changes: [...group.changes],
    counts: { ...group.counts },
  }));
}

function clampGroupedPagination(pagination: ListGroupedChangesPagination): {
  groupLimit: number;
  groupOffset: number;
} {
  const rawLimit = pagination.groupLimit ?? META_PARSER_GROUPED_GROUPS_PER_PAGE;
  const groupLimit = !Number.isInteger(rawLimit)
    ? META_PARSER_GROUPED_GROUPS_PER_PAGE
    : Math.min(Math.max(rawLimit, 1), META_PARSER_GROUPED_MAX_GROUPS);
  const rawOffset = pagination.groupOffset ?? 0;
  const groupOffset = !Number.isInteger(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  return { groupLimit, groupOffset };
}

/** Rows per bounded fetch chunk (PostgREST caps single responses). */
const GROUPED_FETCH_CHUNK = 1000;

/** Rows per distinct entity-type scan chunk (same response cap). */
const ENTITY_TYPE_SCAN_CHUNK = 1000;

/**
 * Grouped entity changes for a patch (RCCF-META-PARSER-UX-07).
 *
 * FILTER → FETCH FILTERED PUBLISHED ROWS → GROUP → SLICE GROUPS. The fetch
 * is bounded server-side (chunked `stable_key`-ordered range reads over the
 * filtered set — one query pattern, never per-entity N+1); only the
 * requested page of whole groups leaves the server, so the browser never
 * receives the full patch dataset and no entity ever spans two pages.
 *
 * Same publication gate and filter semantics as `listChanges`.
 */
export async function listGroupedChanges(
  supabase: SupabaseClient,
  patchId: string,
  filters: ListChangesFilters = {},
  pagination: ListGroupedChangesPagination = {}
): Promise<ListGroupedChangesResult> {
  assertPatchId(patchId);
  const { entityType, changeType, entityNormalized } = assertFilters(filters);
  const { groupLimit, groupOffset } = clampGroupedPagination(pagination);

  if (!(await isPatchPublished(supabase, patchId))) {
    return {
      published: false,
      groups: [],
      groupLimit,
      groupOffset,
      groupTotal: 0,
      changeTotal: 0,
      entityTypeTotals: {},
      hasMore: false,
    };
  }

  const changes: PublishedChange[] = [];
  for (;;) {
    let query = supabase.from("meta_parser_changes").select(CHANGE_COLUMNS).eq("patch_id", patchId);
    if (entityType !== null) query = query.eq("entity_type", entityType);
    if (changeType !== null) query = query.eq("change_type", changeType);
    if (entityNormalized !== null) query = query.eq("entity_normalized", entityNormalized);
    const { data, error } = await query
      .order("stable_key", { ascending: true })
      .range(changes.length, changes.length + GROUPED_FETCH_CHUNK - 1);
    if (error) throw new Error(`Failed to list grouped changes: ${error.message}`);
    const rows = (data ?? []) as Array<Parameters<typeof toPublishedChange>[0]>;
    for (const row of rows) changes.push(toPublishedChange(row));
    if (rows.length < GROUPED_FETCH_CHUNK) break;
  }

  const allGroups = groupPublishedChanges(changes);
  const page = allGroups.slice(groupOffset, groupOffset + groupLimit);
  const entityTypeTotals: Record<string, { groups: number; changes: number }> = {};
  for (const group of allGroups) {
    const entry = entityTypeTotals[group.entityType] ?? { groups: 0, changes: 0 };
    entry.groups += 1;
    entry.changes += group.counts.total;
    entityTypeTotals[group.entityType] = entry;
  }
  return {
    published: true,
    groups: page,
    groupLimit,
    groupOffset,
    groupTotal: allGroups.length,
    changeTotal: changes.length,
    entityTypeTotals,
    hasMore: groupOffset + page.length < allGroups.length,
  };
}
