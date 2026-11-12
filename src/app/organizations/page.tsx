import type { Metadata } from "next";
import { Suspense } from "react";
import { OrganizationFiltersForm } from "./_components/organization-filters";
import { OrganizationResults } from "./_components/organization-results";
import { OrganizationsResultsSkeleton } from "./_components/results-skeleton";
import { buildOrganizationsCanonicalUrl, buildOrganizationsMetadata, parseOrganizationsQuery } from "./_lib/query";

const directoryCopy = buildOrganizationsMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  robots: { index: false, follow: true },
  ...(buildOrganizationsCanonicalUrl("/organizations") === undefined
    ? {}
    : { alternates: { canonical: buildOrganizationsCanonicalUrl("/organizations") } }),
};

// Public organization directory (P8). Thin orchestration only: parse the
// shareable URL query state, render the shell, stream the results block.
// All organization data flows through OrganizationReader (PROPOSED RPC-only,
// no migration exists): no base-table reads, no elevated client, no new RPCs.
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseOrganizationsQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Organization directory</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        Discover public organizations. Teams stay independently discoverable whether or not they
        are associated with an organization.
      </p>

      <div className="mt-6">
        <OrganizationFiltersForm filters={parsed.filters} />
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

      <Suspense fallback={<OrganizationsResultsSkeleton />}>
        <OrganizationResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
