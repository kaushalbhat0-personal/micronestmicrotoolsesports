import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandFiltersForm } from "./_components/brand-filters";
import { BrandResults } from "./_components/brand-results";
import { BrandsResultsSkeleton } from "./_components/results-skeleton";
import { buildBrandsCanonicalUrl, buildBrandsMetadata, parseBrandsQuery } from "./_lib/query";

const directoryCopy = buildBrandsMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  robots: { index: false, follow: true },
  ...(buildBrandsCanonicalUrl("/brands") === undefined
    ? {}
    : { alternates: { canonical: buildBrandsCanonicalUrl("/brands") } }),
};

// Public brand directory (P8). Thin orchestration only: parse the shareable
// URL query state, render the shell, stream the results block. All brand data
// flows through BrandReader (PROPOSED RPC-only, no migration exists): no
// base-table reads, no elevated client, no new RPCs. Interest filters select
// declared intent only — never availability.
export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseBrandsQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Brand directory</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        Discover public brand profiles. Interests are declared intent — they do not claim a brand
        is looking for partners.
      </p>

      <div className="mt-6">
        <BrandFiltersForm filters={parsed.filters} />
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

      <Suspense fallback={<BrandsResultsSkeleton />}>
        <BrandResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
