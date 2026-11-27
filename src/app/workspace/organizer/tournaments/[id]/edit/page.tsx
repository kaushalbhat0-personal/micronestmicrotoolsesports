import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { OrganizerDirectoryValidationError } from "@/features/organizers/domain/organizer";
import { getManagedTournament } from "@/features/organizers/server/organizer-workspace";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSignInPrompt, WorkspaceUnavailable } from "../../../_components/workspace-states";
import { TournamentEditForm } from "../../_components/tournament-edit-form";

export const metadata: Metadata = {
  title: "Edit tournament draft",
  description: "Edit a tournament draft for your organizer profile.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  let tournament: Awaited<ReturnType<typeof getManagedTournament>>;
  try {
    tournament = await getManagedTournament(client, id);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <WorkspaceSignInPrompt />
        </div>
      );
    }
    if (error instanceof OrganizerDirectoryValidationError) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <WorkspaceUnavailable />
      </div>
    );
  }
  if (tournament === null) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-4 text-sm">
        <Link
          href={`/workspace/organizer/tournaments?organizer=${tournament.organizerId}`}
          className="rounded text-slate-600 underline-offset-2 hover:underline"
        >
          ← Back to managed tournaments
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit tournament draft</h1>
      <p className="mt-3 text-sm text-slate-600">
        {tournament.title} (@{tournament.slug}) · {tournament.lifecycle} · your basis:{" "}
        {tournament.role}. Slug and game stay locked; lifecycle transitions need moderator authority
        and are unavailable here.
      </p>
      <TournamentEditForm
        tournamentId={tournament.id}
        initial={{
          title: tournament.title,
          startsAt: tournament.startsAt,
          endsAt: tournament.endsAt,
        }}
      />
    </div>
  );
}
