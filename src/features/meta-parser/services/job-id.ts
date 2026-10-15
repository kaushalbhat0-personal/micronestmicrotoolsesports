/** Ledger job id for the single Meta-Parser ingestion route. */
export const META_PARSER_JOB_ID = "/api/ingest/meta-parser";

/**
 * Per-game ledger key for multi-game observability.
 *
 * Current scheduler/route writes keep the single `META_PARSER_JOB_ID` so
 * existing ledger history stays continuous. Once per-game ledger rows are
 * adopted, callers switch `recordCronRunStart` to this key; the health
 * ledger already aggregates by arbitrary job ids, so no health rewrite is
 * needed. Pure and game-agnostic.
 */
export function metaParserJobIdForGame(gameSlug: string): string {
  return `${META_PARSER_JOB_ID}?game=${gameSlug}`;
}
