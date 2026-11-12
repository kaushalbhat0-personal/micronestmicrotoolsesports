import type { Metadata } from "next";
import { Suspense } from "react";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { listManagedTeams } from "@/features/teams/server/workspace";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceTeamCard } from "./_components/workspace-team-card";
import { WorkspaceEmpty, WorkspaceSignInPrompt, WorkspaceUnavailable } from "./_components/workspace-states";
import { WorkspaceSkeleton } from "./_components/workspace-skeleton";

export const metadata: Metadata = {
  title: "Team workspace",
  description: "Manage the teams you own or captain.",
  // Private authenticated surface: never indexed, never followed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Team workspace index (P2). Thin orchestration: session client, managed
// teams through the session-bound reader, honest states. Unauthenticated →
// sign-in prompt; any other failure (including pre-migration missing tables)
// → generic unavailable (no enumeration, no raw detail).
async function WorkspaceList() {
  const client = await createClient();
  let teams: Awaited<ReturnType<typeof listManagedTeams>>;
  try {
    teams = await listManagedTeams(client);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <WorkspaceSignInPrompt />;
    }
    return <WorkspaceUnavailable />;
  }
  if (teams.length === 0) {
    return <WorkspaceEmpty />;
  }
  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-slate-600">
        {teams.length} {teams.length === 1 ? "team" : "teams"} under your management.
      </p>
      <ul className="mt-4 grid gap-4">
        {teams.map((team) => (
          <li key={team.id}>
            <WorkspaceTeamCard team={team} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkspaceTeamsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team workspace</h1>
      <p className="mt-3 text-sm text-slate-600">
        Teams you own or captain, with your management basis for each. Members see a read-only
        view.
      </p>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <WorkspaceList />
      </Suspense>
    </div>
  );
}
