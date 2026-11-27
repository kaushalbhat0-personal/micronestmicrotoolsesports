// Player share card — allowlisted public projection fields only.
// Never accepts or forwards private identifiers.

import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import { PUBLIC_PROJECTION_COLUMNS } from "@/features/player-profile/domain/public-projection";
import type { ShareCardSpec } from "@/lib/share-kit";

/** Explicit allowlist for share payloads (subset of frozen public columns + URL). */
export const PLAYER_SHARE_FIELD_KEYS = [
  "display_name",
  "ign",
  "handle",
  "avatar_url",
  "game_name",
  "primary_role",
  "region_code",
  "country_code",
  "play_modes",
  "availability",
  "profileUrl",
] as const;

export type PlayerShareFieldKey = (typeof PLAYER_SHARE_FIELD_KEYS)[number];

export interface PlayerShareInput {
  readonly display_name: string;
  readonly ign: string;
  readonly handle: string;
  readonly avatar_url: string | null;
  readonly game_name: string;
  readonly primary_role: string | null;
  readonly region_code: string | null;
  readonly country_code: string | null;
  readonly play_modes: ReadonlyArray<string>;
  readonly availability: ReadonlyArray<string>;
  readonly profileUrl: string;
}

const FORBIDDEN_KEYS = new Set([
  "email",
  "user_id",
  "id",
  "uuid",
  "game_user_id",
  "owner",
  "owner_user_id",
  "verified",
  "is_verified",
  "looking_for",
  "is_discoverable",
]);

/**
 * Build a share input from a public card. Returns null if the caller somehow
 * supplied a non-public shape (defensive — route already 404s private handles).
 */
export function toPlayerShareInput(
  card: PublicPlayerCard,
  profileUrl: string,
): PlayerShareInput | null {
  if (profileUrl.trim() === "") {
    return null;
  }
  // Ensure we only read frozen public keys.
  for (const key of Object.keys(card)) {
    if (!(PUBLIC_PROJECTION_COLUMNS as readonly string[]).includes(key)) {
      return null;
    }
  }
  return {
    display_name: card.display_name,
    ign: card.ign,
    handle: card.handle,
    avatar_url: card.avatar_url,
    game_name: card.game_name,
    primary_role: card.primary_role,
    region_code: card.region_code,
    country_code: card.country_code,
    play_modes: [...card.play_modes],
    availability: [...card.availability],
    profileUrl,
  };
}

export function assertNoForbiddenShareFields(payload: Record<string, unknown>): boolean {
  for (const key of Object.keys(payload)) {
    if (key === "profileUrl") {
      continue;
    }
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function buildPlayerShareSpec(
  input: PlayerShareInput,
  options?: { ownershipReviewed?: boolean | undefined },
): ShareCardSpec {
  const ownershipReviewed = options?.ownershipReviewed === true;
  const location = [input.region_code, input.country_code].filter(
    (part): part is string => part !== null && part.trim() !== "",
  );
  const rows: Array<{ label: string; value: string }> = [
    { label: "IGN", value: input.ign },
    { label: "Handle", value: `@${input.handle}` },
    { label: "Game", value: input.game_name },
  ];
  if (input.primary_role !== null && input.primary_role.trim() !== "") {
    rows.push({ label: "Primary role", value: input.primary_role });
  }
  if (location.length > 0) {
    rows.push({ label: "Region", value: location.join(" · ") });
  }
  if (input.play_modes.length > 0) {
    rows.push({ label: "Play modes", value: input.play_modes.join(" · ") });
  }
  if (input.availability.length > 0) {
    rows.push({ label: "Availability", value: input.availability.join(" · ") });
  }

  return {
    tone: "player",
    eyebrow: ownershipReviewed
      ? "BGMI ownership evidence reviewed"
      : "FRAGIX player identity",
    title: input.display_name,
    subtitle: `${input.game_name} · @${input.handle}`,
    rows,
    disclaimer: ownershipReviewed
      ? "BGMI ownership evidence reviewed by FRAGIX. Not official BGMI or tournament endorsement. Self-reported profile fields."
      : "FRAGIX player identity card. Sharing does not require ownership review. Not official BGMI endorsement.",
    destinationLabel: input.profileUrl.replace(/^https?:\/\//, ""),
    filenameBase: `player-${input.handle}`,
  };
}
