import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import { listManagedOrganizers } from "@/features/organizers/server/organizer-workspace";
import { createClient } from "@/lib/supabase/server";
import {
  WorkspaceEmptyOrganizers,
  WorkspaceSignInPrompt,
  WorkspaceSkeleton,
  WorkspaceUnavailable,
} from "./_components/workspace-states";

export const metadata: Metadata = {
  title: "Organizer workspace",
  description: "Manage your tournament organizer profiles and drafts.",
  // Private authenticated surface: never indexed, never followed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Organizer workspace index (P9). Thin orchestration: session client,
// managed organizers through the session-bound reader, honest states.
// Unauthenticated → sign-in prompt; any other failure (including pre-migration
// missing tables) → generic unavailable. No fake rows, no fake success.
async function WorkspaceList() {
  const client = await createClient();
  let organizers: Awaited<ReturnType<typeof listManagedOrganizers>>;
  try {
    organizers = await listManagedOrganizers(client);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <WorkspaceSignInPrompt />;
    }
    return <WorkspaceUnavailable />;
  }
  if (organizers.length === 0) {
    return <WorkspaceEmptyOrganizers />;
  }
  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-slate-600">
        {organizers.length} {organizers.length === 1 ? "organizer profile" : "organizer profiles"}{" "}
        under your management.
      </p>
      <ul className="mt-4 grid gap-4">
        {organizers.map((organizer) => (
          <li key={organizer.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{organizer.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  @{organizer.slug} · {organizer.role} · {organizer.trustState}
                </p>
              </div>
              <Link
                href={`/workspace/organizer/tournaments?organizer=${organizer.id}`}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Manage tournaments
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrganizerWorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Organizer workspace</h1>
      <p className="mt-3 text-sm text-slate-600">
        Organizer profiles you own or administer, with your management basis for each. Publishing
        stays disabled until ownership and moderation boundaries are approved.
      </p>
      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Organizer publishing is disabled in this phase: organizer ownership, verification and
        tournament moderation boundaries are awaiting decisions. Nothing here can be saved yet.
      </p>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <WorkspaceList />
      </Suspense>
    </div>
  );
}
