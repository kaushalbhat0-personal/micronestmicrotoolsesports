// P9 organizer directory column contract (PROPOSED, migration local-only).
// Mirrors the PROPOSED `search_organizers` / `get_organizer_by_slug` RETURNS
// TABLE column list (see docs/product-development/P9-tournament-organizers/database-and-migration-design.md).
// `get_organizer_by_slug` adds description + website_url + social_links; the
// 8 search columns below are the shared subset. Logic-free: no DB, no mapping.
//
// No logo column in v1: no accepted organizer media contract exists (storage
// bucket reservation only). Cards render an initial-letter mark.
// `published_tournament_count` is DERIVED at read time (count of published
// tournaments for this organizer), never stored.

export const ORGANIZER_DIRECTORY_COLUMNS = [
  "slug",
  "name",
  "region_code",
  "organizer_type",
  "game_keys",
  "trust_state",
  "published_tournament_count",
  "is_public",
] as const;

export type OrganizerDirectoryColumn = (typeof ORGANIZER_DIRECTORY_COLUMNS)[number];

export function isOrganizerDirectoryColumn(value: string): value is OrganizerDirectoryColumn {
  return (ORGANIZER_DIRECTORY_COLUMNS as readonly string[]).includes(value);
}
