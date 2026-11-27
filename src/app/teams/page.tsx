import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamFilters } from "./_components/team-filters";
import { TeamResults } from "./_components/team-results";
import { TeamsResultsSkeleton } from "./_components/results-skeleton";
import { buildTeamsCanonicalUrl, buildTeamsMetadata, parseTeamsQuery } from "./_lib/query";

const directoryCopy = buildTeamsMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  // Team discovery defaults to noindex (same posture as the player
  // directory): query-filtered URLs are never indexed.
  robots: { index: false, follow: true },
  ...(buildTeamsCanonicalUrl("/teams") === undefined
    ? {}
    : { alternates: { canonical: buildTeamsCanonicalUrl("/teams") } }),
};

// Public team directory (P1). Thin orchestration only: parse the shareable
// URL query state, render the shell, stream the results block. All team data
// flows through TeamDirectoryReader (D1 masked RPC pair, UNAPPLIED): no
// base-table reads, no elevated database client, no new RPCs, no invented
// rows. Levels render as self-reported wherever they appear.
export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseTeamsQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Team directory</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        Discover public teams. Only teams that chose to be discoverable appear here.
      </p>

      <div className="mt-6">
        <TeamFilters filters={parsed.filters} />
      </div>

      {parsed.invalid.length > 0 ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Some filters were invalid ({parsed.invalid.join(", ")}) and were ignored. Showing results
          for the remaining filters.
        </p>
      ) : null}

      <Suspense fallback={<TeamsResultsSkeleton />}>
        <TeamResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
