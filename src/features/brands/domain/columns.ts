// P8 brand directory column contract (PROPOSED, no migration exists).
// Mirrors the PROPOSED `search_brands` / `get_brand_by_slug` RETURNS TABLE
// column list (see P8 database-and-security-contracts.md). Detail adds
// description + website_url + social_links; the 8 search columns below are
// the shared subset. Logic-free: no DB, no mapping.
//
// A brand is NOT an organization: no org_type, no team_count, no roster.
// No logo column in v1 (no accepted media contract). No sponsorship
// availability column: interests are declared intent, never confirmed supply.

export const BRAND_DIRECTORY_COLUMNS = [
  "slug",
  "name",
  "industry",
  "region_code",
  "game_interests",
  "partnership_types",
  "sponsorship_interests",
  "trust_state",
] as const;

export type BrandDirectoryColumn = (typeof BRAND_DIRECTORY_COLUMNS)[number];

export function isBrandDirectoryColumn(value: string): value is BrandDirectoryColumn {
  return (BRAND_DIRECTORY_COLUMNS as readonly string[]).includes(value);
}
