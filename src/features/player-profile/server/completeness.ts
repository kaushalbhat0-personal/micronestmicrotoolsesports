// Derived profile-completeness helper (G1-7).
// Authoritative: D-G1-08 approved set (2026-11-11): complete = handle +
// display name + (avatar OR non-empty bio) + >=1 game-specific profile.
// Derived, never stored; informational only — it must not imply identity
// verification, game account verification, trust, eligibility, skill or
// ranking. No discoverability side effects.

export type ProfileCompletenessMissing =
  | "handle"
  | "display_name"
  | "avatar_or_bio"
  | "game_profile";

export interface ProfileCompletenessInput {
  handle: string | null | undefined;
  displayName: string | null | undefined;
  avatarPath: string | null | undefined;
  bio: string | null | undefined;
}

export interface ProfileCompleteness {
  complete: boolean;
  missing: ProfileCompletenessMissing[];
}

function hasHandle(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}

function hasDisplayName(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAvatarOrBio(
  avatarPath: string | null | undefined,
  bio: string | null | undefined,
): boolean {
  if (typeof avatarPath === "string" && avatarPath.length > 0) {
    return true;
  }
  return typeof bio === "string" && bio.trim().length > 0;
}

// Pure derived check over approved canonical fields plus the caller's
// game-profile count (or equivalent safe domain representation). No DB, no
// internal IDs, no frozen-projection dependency.
export function getProfileCompleteness(
  profile: ProfileCompletenessInput,
  gameProfileCount: number,
): ProfileCompleteness {
  const missing: ProfileCompletenessMissing[] = [];
  if (!hasHandle(profile.handle)) {
    missing.push("handle");
  }
  if (!hasDisplayName(profile.displayName)) {
    missing.push("display_name");
  }
  if (!hasAvatarOrBio(profile.avatarPath, profile.bio)) {
    missing.push("avatar_or_bio");
  }
  if (!Number.isInteger(gameProfileCount) || gameProfileCount < 1) {
    missing.push("game_profile");
  }
  return { complete: missing.length === 0, missing };
}
