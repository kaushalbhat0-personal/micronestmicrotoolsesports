/**
 * BGMI Tournament Hub public barrel.
 *
 * Liquipedia-sourced tournament standings, match results, and history.
 * Standings are derived (starting points + match totals) — never stored.
 */
export * from "./types";
export { BGMI_FINISH_POINT_VALUE_2026, BGMI_MAX_PLACEMENT, BGMI_POINTS_TABLE_2026 } from "./services/points";
export { matchTotal, placementPointsFor, stageTotal, isCanonicalTable2026 } from "./services/points";
export { deriveStandings, stageTotalsFrom } from "./services/standings";
export { validateStageDataset } from "./services/validate";
export type { StageValidationWarning } from "./services/validate";
export { ingestTournamentStage } from "./services/ingest";
export type { StageIngestOptions, StageIngestReport } from "./services/ingest";
export {
  LIQUIPEDIA_ADAPTER_VERSION,
  LIQUIPEDIA_PARSER_VERSION,
  ROTATION_STAGE_EXPECTED_MAPS,
  ROTATION_STAGE_KEYS,
  SUPPORTED_STAGE_KEYS,
  TOURNAMENT_CATALOG,
  assertCanonicalScoring,
  displayTeamName,
  extractSection,
  extractStageSection,
  extractTemplateAt,
  fetchTournamentSource,
  findTemplates,
  getCatalogEntry,
  isEmptyMsCell,
  isRotationStage,
  isSatOutMsCell,
  normalizeTeamKey,
  parseInfoboxLeague,
  parseMapDate,
  parseMatchBlock,
  parseStageDataset,
  parseTournamentStage,
  splitParams,
  toSourceUrl,
} from "./adapters/liquipedia";
export type { LiquipediaSourceSnapshot, ParsedMapCell, ParsedMatchBlock, ParsedTeamCell, RotationStageKey, SupportedStageKey, TournamentCatalogEntry } from "./adapters/liquipedia";
export { LIQUIPEDIA_API_HOST, LIQUIPEDIA_API_PATH_PREFIX } from "./adapters/safe-fetch";
export { createSupabaseBgmiStore } from "./repositories/store";
export type { BgmiStore } from "./repositories/store";
export {
  getStageDetail,
  getTournament,
  isTournamentSlug,
  listStages,
  listTournaments,
} from "./repositories/reads";
export type { PublishedMatch, PublishedStageDetail, PublishedStageSummary, PublishedTournament } from "./repositories/reads";
