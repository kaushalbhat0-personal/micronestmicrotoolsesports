import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getOwnProfile } from "@/features/player-profile/server/player-profile";
import { getOwnGameProfiles } from "@/features/player-profile/server/game-profile";
import { getHandleChangeState } from "@/features/player-profile/server/handle";
import { getProfileCompleteness } from "@/features/player-profile/server/completeness";
import { AVATAR_BUCKET } from "@/features/player-profile/schemas/avatar";
import { createClient } from "@/lib/supabase/server";
import { DiscoverabilitySection } from "./_components/discoverability-section";
import { GameVisibilitySection } from "./_components/game-visibility-section";
import { HandleSection } from "./_components/handle-section";
import { CompletenessSection } from "./_components/completeness-section";
import { DangerZoneSection } from "./_components/danger-zone-section";
import { ProfileDetailsSection } from "./_components/profile-details-section";
import { GameDetailsSection } from "./_components/game-details-section";
import { BgmiPlayerIdSection } from "./_components/bgmi-player-id-section";
import { BgmiOwnershipVerificationSection } from "./_components/bgmi-ownership-verification-section";
import { AvatarSection } from "./_components/avatar-section";
import {
  getMyBgmiOwnershipCaseStatus,
  listMyBgmiOwnershipEvidenceSummary,
} from "@/features/player-profile/server/bgmi-ownership";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Edit your player profile, avatar, and discoverability settings.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Owner settings (G1-7 / P15-M2B.1). Thin orchestration only.
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
        <p className="mt-4">
          <Link
            href={"/onboarding/profile" as Route}
            className="bg-accent-600 hover:bg-accent-700 inline-flex min-h-[44px] items-center px-4 text-sm font-bold tracking-wide text-white uppercase"
          >
            Complete your profile
          </Link>
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

  const avatarPublicUrl =
    profile.avatar_path !== null && profile.avatar_path.length > 0
      ? client.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path).data.publicUrl
      : null;

  const bgmiGame = games.find((g) => g.game_key === "bgmi") ?? null;
  const ownershipCase = await getMyBgmiOwnershipCaseStatus(client).catch(() => null);
  const ownershipEvidence =
    ownershipCase !== null && ownershipCase.status === "draft"
      ? await listMyBgmiOwnershipEvidenceSummary(client, ownershipCase.id).catch(() => [])
      : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile settings</h1>
      <p className="mt-3 text-sm text-slate-600">
        Edit your public profile details, game profiles, and avatar. Discoverability requires a
        complete profile plus your explicit consent. Verification is separate and not required for
        the directory.
      </p>

      <div className="mt-8 space-y-6">
        <CompletenessSection complete={completeness.complete} missing={completeness.missing} />
        <ProfileDetailsSection
          displayName={profile.display_name}
          bio={profile.bio}
          countryCode={profile.country_code}
        />
        <AvatarSection
          avatarPublicUrl={avatarPublicUrl}
          hasAvatar={profile.avatar_path !== null && profile.avatar_path.length > 0}
        />
        {games.map((game) => (
          <div key={game.game_key} className="space-y-6">
            <GameDetailsSection
              game={{
                game_key: game.game_key,
                ign: game.ign,
                primary_role: game.primary_role,
                region_code: game.region_code,
                play_modes: game.play_modes,
                availability: game.availability,
              }}
            />
            <BgmiPlayerIdSection gameKey={game.game_key} gameUserId={game.game_user_id} />
          </div>
        ))}
        {bgmiGame ? (
          <BgmiOwnershipVerificationSection
            gameUserId={bgmiGame.game_user_id}
            caseStatus={ownershipCase}
            evidence={ownershipEvidence}
          />
        ) : null}
        <DiscoverabilitySection
          isDiscoverable={profile.is_discoverable}
          profileComplete={completeness.complete}
          missing={completeness.missing}
        />
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
        <DangerZoneSection
          handle={profile.handle}
          games={games.map((g) => ({ game_key: g.game_key, ign: g.ign }))}
        />
      </div>
    </div>
  );
}
