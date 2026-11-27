import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import {
  OrganizerDirectoryValidationError,
  OrganizerDirectoryOperationError,
} from "@/features/organizers/domain/organizer";
import {
  listManagedOrganizers,
  listManagedTournaments,
} from "@/features/organizers/server/organizer-workspace";
import { createClient } from "@/lib/supabase/server";
import {
  WorkspaceSignInPrompt,
  WorkspaceSkeleton,
  WorkspaceUnavailable,
} from "../_components/workspace-states";

export const metadata: Metadata = {
  title: "Managed tournaments",
  description: "Review your organizer tournament drafts and published listings.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ManagedList({ organizerId }: { organizerId: string | undefined }) {
  const client = await createClient();
  try {
    const organizers = await listManagedOrganizers(client);
    if (organizerId === undefined) {
      return (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Choose an organizer</h2>
          {organizers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No organizer profiles under your management yet. Publishing is disabled in this phase,
              so new profiles cannot be saved yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {organizers.map((organizer) => (
                <li key={organizer.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <Link
                    href={`/workspace/organizer/tournaments?organizer=${organizer.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {organizer.name} (@{organizer.slug})
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">{organizer.role}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    if (!UUID_RE.test(organizerId)) {
      throw new OrganizerDirectoryValidationError();
    }
    const tournaments = await listManagedTournaments(client, organizerId);
    return (
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-slate-600">
            {tournaments.length === 0
              ? "No tournaments under this organizer yet."
              : `${tournaments.length} ${tournaments.length === 1 ? "tournament" : "tournaments"}.`}
          </p>
          <Link
            href={`/workspace/organizer/tournaments/new?organizer=${organizerId}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            New tournament draft
          </Link>
        </div>
        {tournaments.length === 0 ? null : (
          <ul className="mt-4 grid gap-3">
            {tournaments.map((tournament) => (
              <li key={tournament.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{tournament.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      @{tournament.slug} · {tournament.lifecycle} · {tournament.role}
                    </p>
                  </div>
                  <Link
                    href={`/workspace/organizer/tournaments/${tournament.id}/edit`}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Edit draft
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Submission and publication are disabled: publishing a tournament requires an approved
          moderation boundary. Drafts validate locally but cannot be saved or submitted yet.
        </p>
      </div>
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <WorkspaceSignInPrompt />;
    }
    if (error instanceof OrganizerDirectoryValidationError) {
      return (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold">Invalid organizer reference</h2>
          <p className="mt-2 text-sm text-slate-600">
            This organizer reference is not available. Choose an organizer again.
          </p>
          <Link
            href="/workspace/organizer/tournaments"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Choose organizer
          </Link>
        </div>
      );
    }
    if (error instanceof OrganizerDirectoryOperationError) {
      return <WorkspaceUnavailable />;
    }
    return <WorkspaceUnavailable />;
  }
}

export default function ManagedTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-4 text-sm">
        <Link
          href="/workspace/organizer"
          className="rounded text-slate-600 underline-offset-2 hover:underline"
        >
          ← Back to organizer workspace
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Managed tournaments</h1>
      <p className="mt-3 text-sm text-slate-600">
        Drafts, submitted listings and published tournaments for one organizer. Cross-organizer
        access is never permitted.
      </p>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <ManagedListLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ManagedListLoader({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const value = raw["organizer"];
  const organizerId = Array.isArray(value) ? value[0] : value;
  return <ManagedList organizerId={organizerId} />;
}
