// P4 News — frozen public column set for the PROPOSED masked RPC pair
// (no migration exists). Mirrors the P3 tournaments posture: exact key order
// is asserted at read time so unexpected columns fail closed.

export const NEWS_DIRECTORY_COLUMNS = [
  "slug",
  "headline",
  "summary",
  "category",
  "game_key",
  "tags",
  "hero_image_url",
  "hero_image_alt",
  "author_display_name",
  "published_at",
  "updated_at",
] as const;

export type NewsDirectoryColumn = (typeof NEWS_DIRECTORY_COLUMNS)[number];
