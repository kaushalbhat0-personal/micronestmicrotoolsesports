import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { WorkspaceValidationError } from "@/features/teams/domain/workspace";
import { getManagedTeam } from "@/features/teams/server/workspace";
import { createClient } from "@/lib/supabase/server";
import { PermissionNote } from "../../_components/permission-note";
import { TeamSettingsForm } from "../../_components/team-settings-form";
import { WorkspaceSignInPrompt, WorkspaceUnavailable } from "../../_components/workspace-states";
import { isInvalidTeamId, parseWorkspaceTeamId } from "../../_lib/params";

type IdParams = { id: string };

export const metadata: Metadata = {
  title: "Team settings",
  description: "Edit the profile fields of a team you manage.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Team settings (P2). Owners and captains see the editable-field form
// (validation presentation only — saving disabled, see boundary notice).
// Members see a read-only notice: no edit affordance is offered without
// authority. Protected fields render locked or not at all; ownership
// transfer has no UI. Invalid/invisible ids → notFound.
export default async function WorkspaceTeamSettingsPage({
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
  const canEdit = team.role === "owner" || team.role === "captain";
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
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team settings</h1>
      <p className="mt-3 text-sm text-slate-600">
        Public profile fields for {team.name}. Identity, game, ownership and organization fields
        are never editable here.
      </p>
      <div className="mt-6">
        {canEdit ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            <TeamSettingsForm team={team} />
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <h2 className="text-lg font-semibold">Read-only for members</h2>
            <p className="mt-2 text-sm text-slate-600">
              Only owners and captains edit team settings. Your membership is read-only.
            </p>
          </div>
        )}
      </div>
      <div className="mt-6">
        <PermissionNote role={team.role} />
      </div>
    </div>
  );
}
