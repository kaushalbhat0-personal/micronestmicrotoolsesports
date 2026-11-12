import type { Metadata } from "next";
import { Suspense } from "react";
import { OrganizerFiltersForm } from "./_components/organizer-filters";
import { OrganizerResults } from "./_components/organizer-results";
import { OrganizersResultsSkeleton } from "./_components/results-skeleton";
import {
  buildOrganizersCanonicalUrl,
  buildOrganizersMetadata,
  parseOrganizersQuery,
} from "./_lib/query";

const directoryCopy = buildOrganizersMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  robots: { index: false, follow: true },
  ...(buildOrganizersCanonicalUrl("/organizers") === undefined
    ? {}
    : { alternates: { canonical: buildOrganizersCanonicalUrl("/organizers") } }),
};

// Public organizer directory (P9). Thin orchestration only: parse the
// shareable URL query state, render the shell, stream the results block.
// All organizer data flows through OrganizerReader (PROPOSED masked RPC-only,
// local migration): no base-table reads, no elevated client, no new RPCs.
export default async function OrganizersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseOrganizersQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="bg-arena-950 overflow-hidden rounded-lg text-white">
        <div className="border-accent-600 border-b-2 px-4 py-8 sm:px-6">
          <p className="text-accent-300 text-xs font-bold tracking-[0.18em] uppercase">
            Organizers
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            Organizers
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Discover who runs MicroNest tournaments. Organizer identities are self-declared until
            MicroNest review confirms them.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <OrganizerFiltersForm filters={parsed.filters} />
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

      <Suspense fallback={<OrganizersResultsSkeleton />}>
        <OrganizerResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
