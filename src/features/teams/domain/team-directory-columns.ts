// Public team-directory column contract (P1).
// Mirrors the D1 `search_teams` / `get_team_by_slug` RETURNS TABLE column
// list (local, UNAPPLIED). `get_team_by_slug` adds `description`; the 9
// search columns below are the shared subset. Logic-free: no DB, no mapping.

export const TEAM_DIRECTORY_COLUMNS = [
  "id",
  "slug",
  "name",
  "game_key",
  "region_code",
  "current_level",
  "target_level",
  "recruiting",
  "member_count",
] as const;

export type TeamDirectoryColumn = (typeof TEAM_DIRECTORY_COLUMNS)[number];

export function isTeamDirectoryColumn(value: string): value is TeamDirectoryColumn {
  return (TEAM_DIRECTORY_COLUMNS as readonly string[]).includes(value);
}
