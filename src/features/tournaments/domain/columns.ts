// Proposed tournament directory column contract (P3).
// Mirrors the PROPOSED `search_tournaments` / `get_tournament_by_slug`
// RETURNS TABLE column list (no migration exists — see
// docs/product-development/P3-tournament-discovery/04-data-model.md).
// `get_tournament_by_slug` adds description/contact/eligibility; the 14
// search columns below are the shared subset. Logic-free: no DB, no mapping.

export const TOURNAMENT_DIRECTORY_COLUMNS = [
  "slug",
  "title",
  "game_key",
  "region_code",
  "format",
  "starts_at",
  "ends_at",
  "timezone",
  "entry_fee",
  "prize_pool",
  "organizer",
  "lifecycle",
  "registration_url",
  "registration_closes_at",
] as const;

export type TournamentDirectoryColumn = (typeof TOURNAMENT_DIRECTORY_COLUMNS)[number];

export function isTournamentDirectoryColumn(value: string): value is TournamentDirectoryColumn {
  return (TOURNAMENT_DIRECTORY_COLUMNS as readonly string[]).includes(value);
}
