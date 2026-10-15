/**
 * Meta-Parser public barrel. Game adapters register explicitly —
 * MLBB (and every future game) stays out until its audit gates clear.
 */
export * from "./types";
export { sanitizePatchText, containsMarkup } from "./services/sanitize";
export { normalizeEntityName } from "./services/entity-normalize";
export {
  META_PARSER_CONFLICT_CODE,
  KNOWN_UNIQUE_CONSTRAINTS,
  isConflictError,
  isUniqueViolationMessage,
} from "./services/conflict";
export { extractTransition } from "./services/numeric-extract";
export type { NumericTransition } from "./services/numeric-extract";
export {
  classifyChange,
  compareLevelValues,
  normalizeAttribute,
  resolvePolarity,
} from "./services/direction-map";
export { safeFetchText } from "./services/safe-fetch";
export { ingestGamePatches } from "./services/ingest";
export type {
  IngestGameOptions,
  IngestGameReport,
  MetaParserStore,
  PatchChangeInsert,
  StoredGameRow,
  StoredPatchRow,
} from "./services/ingest";
export { assessFreshness, META_PARSER_STALE_AFTER_DAYS } from "./services/health";
export { META_PARSER_JOB_ID } from "./services/job-id";
export {
  clearAdapterRegistry,
  getAdapter,
  registerAdapter,
  registeredAdapterKeys,
} from "./adapters/registry";
export type {
  CorpusFetch,
  DiscoveredPatch,
  MetaParserAdapter,
} from "./adapters/registry";
export { dota2Adapter, DOTA_ADAPTER_VERSION, DOTA_PARSER_VERSION } from "./adapters/dota-2/adapter";
export { createSupabaseMetaParserStore } from "./repositories/store";
export {
  META_PARSER_PUBLISHED_STATUS,
  META_PARSER_STAGING_STATUS,
  META_PARSER_READ_DEFAULT_LIMIT,
  META_PARSER_READ_MAX_LIMIT,
  listGames,
  listPatches,
  getPatch,
  listChanges,
} from "./repositories/reads";
export type {
  PublishedGame,
  PublishedPatch,
  PublishedPatchHeader,
  PublishedChange,
  ListChangesFilters,
  ListChangesPagination,
  ListChangesResult,
  ReadableEntityType,
  ReadableChangeType,
} from "./repositories/reads";
