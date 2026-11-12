import type { Metadata } from "next";
import { getOwnProfile } from "@/features/player-profile/server/player-profile";
import { getOwnGameProfiles } from "@/features/player-profile/server/game-profile";
import { getHandleChangeState } from "@/features/player-profile/server/handle";
import { getProfileCompleteness } from "@/features/player-profile/server/completeness";
import { createClient } from "@/lib/supabase/server";
import { DiscoverabilitySection } from "./_components/discoverability-section";
import { GameVisibilitySection } from "./_components/game-visibility-section";
import { HandleSection } from "./_components/handle-section";
import { CompletenessSection } from "./_components/completeness-section";
import { DangerZoneSection } from "./_components/danger-zone-section";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Manage your player profile discoverability, handle and deletion.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Owner settings (G1-7). Thin orchestration only: establish the session
// client, load the caller's own rows through the narrow server operations,
// pass data to section components. No base-table reads for others, no
// elevated client, no public-projection dependency.
export default async function ProfileSettingsPage() {
  const client = await createClient();

  let profile: Awaited<ReturnType<typeof getOwnProfile>>;
  try {
    profile = await getOwnProfile(client);
  } catch {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile settings</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in to manage your player profile settings.
        </p>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile settings</h1>
        <p className="mt-3 text-sm text-slate-600">
          You do not have a player profile yet. Create one to manage discoverability, handle
          and deletion settings.
        </p>
      </div>
    );
  }

  const games = await getOwnGameProfiles(client).catch(() => []);
  const handleState = await getHandleChangeState(client).catch(() => ({
    handle: profile.handle,
    handleChangedAt: null as string | null,
    nextEligibleAt: null as string | null,
  }));
  const completeness = getProfileCompleteness(
    {
      handle: profile.handle,
      displayName: profile.display_name,
      avatarPath: profile.avatar_path,
      bio: profile.bio,
    },
    games.length,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile settings</h1>
      <p className="mt-3 text-sm text-slate-600">
        Manage discoverability, per-game visibility, your handle and profile deletion. Changes
        apply to your profile only.
      </p>

      <div className="mt-8 space-y-6">
        <DiscoverabilitySection isDiscoverable={profile.is_discoverable} />
        <GameVisibilitySection
          games={games.map((g) => ({
            game_key: g.game_key,
            ign: g.ign,
            is_visible: g.is_visible,
          }))}
          masterDiscoverable={profile.is_discoverable}
        />
        <HandleSection
          handle={handleState.handle}
          nextEligibleAt={handleState.nextEligibleAt}
        />
        <CompletenessSection
          complete={completeness.complete}
          missing={completeness.missing}
        />
        <DangerZoneSection
          handle={profile.handle}
          games={games.map((g) => ({ game_key: g.game_key, ign: g.ign }))}
        />
      </div>
    </div>
  );
}
