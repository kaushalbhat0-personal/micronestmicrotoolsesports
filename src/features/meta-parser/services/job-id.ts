/** Ledger job id for the single Meta-Parser ingestion route. */
export const META_PARSER_JOB_ID = "/api/ingest/meta-parser";

/**
 * Per-game ledger key for multi-game observability.
 *
 * Adopted by the ingestion route: every scheduled run records under its
 * game-scoped key, so Superadmin health can attribute last-attempt and
 * last-failure per source. The bare `META_PARSER_JOB_ID` remains as the
 * legacy key — pre-per-game history falls back to it for freshness only,
 * never for per-game run/failure attribution. Pure and game-agnostic.
 */
export function metaParserJobIdForGame(gameSlug: string): string {
  return `${META_PARSER_JOB_ID}?game=${gameSlug}`;
}
