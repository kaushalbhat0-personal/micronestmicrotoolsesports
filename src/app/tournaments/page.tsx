import type { Metadata } from "next";
import { Suspense } from "react";
import { TournamentFilters } from "./_components/tournament-filters";
import { TournamentResults } from "./_components/tournament-results";
import { TournamentsResultsSkeleton } from "./_components/results-skeleton";
import {
  buildTournamentsCanonicalUrl,
  buildTournamentsMetadata,
  parseTournamentsQuery,
} from "./_lib/query";

const directoryCopy = buildTournamentsMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  // Tournament discovery defaults to noindex (same posture as the player
  // and team directories): query-filtered URLs are never indexed.
  robots: { index: false, follow: true },
  ...(buildTournamentsCanonicalUrl("/tournaments") === undefined
    ? {}
    : { alternates: { canonical: buildTournamentsCanonicalUrl("/tournaments") } }),
};

// Public tournament directory (P3). Thin orchestration only: parse the
// shareable URL query state, render the shell, stream the results block.
// All tournament data flows through TournamentReader (PROPOSED masked RPC
// pair, no migration exists): no base-table reads, no elevated database
// client, no new RPCs, no invented rows.
export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseTournamentsQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-lg bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">
            Tournaments
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            Compete
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Discover tournaments and understand whether you can participate — entry terms,
            eligibility, and registration handoff up front.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <TournamentFilters filters={parsed.filters} />
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

      <Suspense fallback={<TournamentsResultsSkeleton />}>
        <TournamentResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
