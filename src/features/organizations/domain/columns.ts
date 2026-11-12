// P8 organization directory column contract (PROPOSED, no migration exists).
// Mirrors the PROPOSED `search_organizations` / `get_organization_by_slug`
// RETURNS TABLE column list (see docs/product-development/P8-org-brand-discovery/08-database-and-security-contracts.md).
// `get_organization_by_slug` adds description + website_url + social_links;
// the 7 search columns below are the shared subset. Logic-free: no DB, no mapping.
//
// No logo column in v1: no safe media contract is accepted (storage bucket
// reservation only). Cards render an initial-letter mark instead of imagery.

export const ORGANIZATION_DIRECTORY_COLUMNS = [
  "slug",
  "name",
  "region_code",
  "org_type",
  "game_keys",
  "trust_state",
  "team_count",
] as const;

export type OrganizationDirectoryColumn = (typeof ORGANIZATION_DIRECTORY_COLUMNS)[number];

export function isOrganizationDirectoryColumn(value: string): value is OrganizationDirectoryColumn {
  return (ORGANIZATION_DIRECTORY_COLUMNS as readonly string[]).includes(value);
}
