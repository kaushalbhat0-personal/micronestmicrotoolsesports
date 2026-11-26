// Compose G1 profile + game rows into an onboarding snapshot (P14-D12).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveOnboardingStatus,
  type OnboardingStatusSnapshot,
} from "../domain/onboarding-status";
import { getProfileCompleteness } from "./completeness";
import { getOwnGameProfiles } from "./game-profile";
import { getOwnProfile } from "./player-profile";

export async function getOwnOnboardingStatus(
  client: SupabaseClient,
): Promise<OnboardingStatusSnapshot> {
  const profile = await getOwnProfile(client);
  if (profile === null) {
    return resolveOnboardingStatus(false, null);
  }
  const games = await getOwnGameProfiles(client);
  const completeness = getProfileCompleteness(
    {
      handle: profile.handle,
      displayName: profile.display_name,
      avatarPath: profile.avatar_path,
      bio: profile.bio,
    },
    games.length,
  );
  return resolveOnboardingStatus(true, completeness);
}
