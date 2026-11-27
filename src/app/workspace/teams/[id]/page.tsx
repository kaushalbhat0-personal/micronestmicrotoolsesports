import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { WorkspaceValidationError } from "@/features/teams/domain/workspace";
import { getManagedTeam } from "@/features/teams/server/workspace";
import { createClient } from "@/lib/supabase/server";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import { SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";
import { PermissionNote } from "../_components/permission-note";
import { WorkspaceSignInPrompt, WorkspaceUnavailable } from "../_components/workspace-states";
import { isInvalidTeamId, parseWorkspaceTeamId } from "../_lib/params";

type IdParams = { id: string };

export const metadata: Metadata = {
  title: "Team overview",
  description: "Overview of a team you manage.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Team overview (P2). Resolves the id through getManagedTeam only:
// session-scoped base reads under RLS, no elevated client, no new RPCs.
// Invalid ids and invisible teams → identical notFound (no existence
// oracle). Unauthenticated → sign-in prompt; other failures → generic
// unavailable inline (never raw detail).
export default async function WorkspaceTeamOverviewPage({
  params,
}: {
  params: Promise<IdParams>;
}) {
  const { id } = await params;
  const parsed = parseWorkspaceTeamId(id);
  if (isInvalidTeamId(parsed)) {
    notFound();
  }
  const client = await createClient();
  let team: Awaited<ReturnType<typeof getManagedTeam>>;
  try {
    team = await getManagedTeam(client, parsed.id);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <WorkspaceSignInPrompt />;
    }
    if (error instanceof WorkspaceValidationError) {
      notFound();
    }
    return <WorkspaceUnavailable />;
  }
  if (team === null) {
    notFound();
  }
  const gameName = getGameByKey(team.game_key)?.name ?? team.game_key;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/workspace/teams"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to workspace
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</h1>
      <p className="mt-1 text-sm text-slate-600">
        @{team.slug} · {gameName} · {team.region_code}
      </p>
      <p className="mt-2 text-sm text-slate-600" title={SELF_REPORTED_LEVEL_NOTE}>
        {team.current_level} → {team.target_level}{" "}
        <span className="text-slate-500">(self-reported)</span> ·{" "}
        {team.recruiting ? "Recruiting" : "Not recruiting"} ·{" "}
        {team.is_public ? "Public" : "Hidden"} · {team.member_count}{" "}
        {team.member_count === 1 ? "member" : "members"}
      </p>

      <nav
        aria-label="Team management sections"
        className="mt-6 flex flex-wrap gap-2 text-sm"
      >
        <Link
          href={`/workspace/teams/${team.id}/settings`}
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Settings
        </Link>
        <Link
          href={`/workspace/teams/${team.id}/roster`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Roster
        </Link>
        <Link
          href={`/teams/${team.slug}`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Public page
        </Link>
      </nav>

      <div className="mt-6">
        <PermissionNote role={team.role} />
      </div>
    </div>
  );
}
