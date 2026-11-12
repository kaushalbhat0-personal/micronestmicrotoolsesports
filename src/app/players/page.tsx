import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActiveFilters } from "./_components/active-filters";
import { DirectoryFilters } from "./_components/directory-filters";
import { DirectoryResults } from "./_components/directory-results";
import { FilterPanel } from "./_components/filter-panel";
import { ResultsSkeleton } from "./_components/results-skeleton";
import {
  buildCanonicalUrl,
  buildDirectoryMetadata,
  parseDirectoryQuery,
} from "./_lib/query";

const directoryCopy = buildDirectoryMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  // No indexing opt-in exists in the frozen projection (04 section 4), so the
  // directory defaults to noindex. Query-filtered URLs are never indexed.
  robots: { index: false, follow: true },
  ...(buildCanonicalUrl("/players") === undefined
    ? {}
    : { alternates: { canonical: buildCanonicalUrl("/players") } }),
};

// Public player directory (G1-6). Thin orchestration only: parse the
// shareable URL query state, render the shell, stream the results block.
// All player data flows through DirectoryReader (APPROVED D-G1-03 RPC-only):
// no base-table reads, no elevated database client, no new RPCs.
export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseDirectoryQuery(await searchParams);
  const activeCount = Object.values(parsed.filters).filter(
    (value) => value !== undefined
  ).length;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">
            <span aria-hidden="true" className="inline-block h-3 w-1 bg-accent-600" />
            Player discovery
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            Discover esports players.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Explore opt-in player profiles across supported titles, starting
            with BGMI. Search by game, role, region or name — only players
            who chose to be discoverable appear.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-400">
            Listings show self-declared information only. No contact details,
            and no verification of identity or skill is implied.{" "}
            <Link
              href="/about"
              className="font-semibold text-slate-200 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              How opt-in discovery works
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <FilterPanel activeCount={activeCount}>
          <DirectoryFilters filters={parsed.filters} />
        </FilterPanel>
      </div>

      <ActiveFilters filters={parsed.filters} />

      {parsed.invalid.length > 0 ? (
        <p
          role="status"
          className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Some filters were invalid ({parsed.invalid.join(", ")}) and were ignored. Showing results
          for the remaining filters.
        </p>
      ) : null}

      <Suspense fallback={<ResultsSkeleton />}>
        <DirectoryResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
