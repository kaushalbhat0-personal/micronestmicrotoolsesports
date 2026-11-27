import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { WorkspaceValidationError } from "@/features/teams/domain/workspace";
import { listTeamRoster } from "@/features/teams/server/workspace";
import { createClient } from "@/lib/supabase/server";
import { RosterList } from "../../_components/roster-list";
import { WorkspaceSignInPrompt, WorkspaceUnavailable } from "../../_components/workspace-states";
import { isInvalidTeamId, parseWorkspaceTeamId } from "../../_lib/params";

type IdParams = { id: string };

export const metadata: Metadata = {
  title: "Team roster",
  description: "Roster of a team you manage.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Team roster (P2). Member-gated reads under RLS; role/game-role/self
// markers only — no user_ids rendered, no applicant data. Roster changes
// (add/remove, captain assignment, application-driven joins) have no
// controls: the list states the boundary. Invalid/invisible ids → notFound.
export default async function WorkspaceTeamRosterPage({
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
  let result: Awaited<ReturnType<typeof listTeamRoster>>;
  try {
    result = await listTeamRoster(client, parsed.id);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <WorkspaceSignInPrompt />;
    }
    if (error instanceof WorkspaceValidationError) {
      notFound();
    }
    return <WorkspaceUnavailable />;
  }
  if (result === null) {
    notFound();
  }
  const { team, members } = result;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href={`/workspace/teams/${team.id}`}
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to {team.name}
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Roster</h1>
      <p role="status" className="mt-3 text-sm text-slate-600">
        {members.length} {members.length === 1 ? "member" : "members"} on {team.name}.
        {team.role === "member" ? " You view this roster as a member." : ""}
      </p>
      <div className="mt-6">
        <RosterList members={members} />
      </div>
    </div>
  );
}
