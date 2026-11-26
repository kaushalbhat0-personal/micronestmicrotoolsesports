import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { canAttemptTeamCreate } from "@/features/player-profile/domain/access-policy";
import { getOwnOnboardingStatus } from "@/features/player-profile/server/resolve-onboarding";
import { createClient } from "@/lib/supabase/server";
import { TeamForm } from "../_components/team-form";
import { buildTeamsCanonicalUrl } from "../_lib/query";

export const metadata: Metadata = {
  title: "Create a team",
  description: "Start a new MicroNest Esports team for your game and region.",
  robots: { index: false, follow: true },
  ...(buildTeamsCanonicalUrl("/teams/new") === undefined
    ? {}
    : { alternates: { canonical: buildTeamsCanonicalUrl("/teams/new") } }),
};

export const dynamic = "force-dynamic";

// Team creation (P14-D6 + soft onboarding gate P14-D12).
// Soft UI guidance only — create_team RPC remains the hard security gate.
export default async function NewTeamPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  let softGate: ReturnType<typeof canAttemptTeamCreate> | null = null;
  if (user) {
    try {
      const onboarding = await getOwnOnboardingStatus(client);
      softGate = canAttemptTeamCreate(onboarding.status);
    } catch {
      softGate = canAttemptTeamCreate("not_started");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/teams"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to team directory
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Create a team</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        Set up your team identity, game, region and competitive context. Levels are self-reported —
        never a MicroNest rating.
      </p>

      {!user ? (
        <p className="mt-6 text-sm text-slate-600">
          <Link href="/login?next=/teams/new" className="text-accent-600 font-semibold underline">
            Log in
          </Link>{" "}
          to create a team.
        </p>
      ) : softGate && !softGate.allowed ? (
        <div className="mt-6 border border-slate-200 bg-white p-4 sm:p-6">
          <p className="text-sm text-slate-700">{softGate.reason}</p>
          <p className="mt-4">
            <Link
              href={"/onboarding/profile" as Route}
              className="bg-accent-600 hover:bg-accent-700 inline-flex min-h-[44px] items-center px-4 text-sm font-bold tracking-wide text-white uppercase"
            >
              Complete your profile
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <TeamForm />
        </div>
      )}
    </div>
  );
}
