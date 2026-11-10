/**
 * Shared conflict + uniqueness helpers for the Meta-Parser store boundary.
 *
 * Conflict detection is deliberately precise: PostgreSQL 23505 or a known
 * Meta-Parser unique-constraint name. Bare words like "duplicate" never
 * qualify — an unrelated error must never be mistaken for an expected
 * ingestion race.
 */

/** Code attached to unique-violation errors from insertPatch (23505 races). */
export const META_PARSER_CONFLICT_CODE = "META_PARSER_CONFLICT";

/** Unique constraints the ingestion pipeline is allowed to race on. */
export const KNOWN_UNIQUE_CONSTRAINTS: readonly string[] = [
  "meta_parser_patches_source_url",
  "meta_parser_patches_game_version_unique",
  "meta_parser_changes_patch_stable_unique",
  "meta_parser_aliases_game_normalized_unique",
];

/** True only for genuine unique-violation messages. Never throws. */
export function isUniqueViolationMessage(message: string): boolean {
  if (typeof message !== "string" || message === "") return false;
  if (message.includes("23505")) return true;
  return KNOWN_UNIQUE_CONSTRAINTS.some((name) => message.includes(name));
}

/** True when an error represents an expected logical-patch race. */
export function isConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === META_PARSER_CONFLICT_CODE) return true;
  return error instanceof Error && isUniqueViolationMessage(error.message);
}
