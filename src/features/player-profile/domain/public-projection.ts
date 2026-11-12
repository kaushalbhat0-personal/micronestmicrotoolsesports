// Frozen public-projection contract (APPROVED D-G1-03).
// Authoritative: 04 §5 + 05 §5 + 11 §3. Logic-free: no DB, no mapping.
// Any RPC output drift must fail the G1-4 key-set test, not silently widen.

export const PUBLIC_PROJECTION_COLUMNS = [
  "handle",
  "display_name",
  "avatar_url",
  "bio",
  "country_code",
  "game_key",
  "game_name",
  "ign",
  "primary_role",
  "play_modes",
  "region_code",
  "availability",
] as const;

export type PublicProjectionColumn =
  (typeof PUBLIC_PROJECTION_COLUMNS)[number];

export function isPublicProjectionColumn(
  value: string,
): value is PublicProjectionColumn {
  return (PUBLIC_PROJECTION_COLUMNS as readonly string[]).includes(value);
}
