import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolsFilters } from "./_components/tools-filters";
import { ToolsResults } from "./_components/tools-results";
import { buildToolsCanonicalUrl, buildToolsMetadata, parseToolsQuery } from "./_lib/query";

const directoryCopy = buildToolsMetadata();

export const metadata: Metadata = {
  title: directoryCopy.title,
  description: directoryCopy.description,
  robots: { index: false, follow: true },
  ...(buildToolsCanonicalUrl("/tools") === undefined
    ? {}
    : { alternates: { canonical: buildToolsCanonicalUrl("/tools") } }),
};

// Public tools directory (P5). Thin orchestration: parse the shareable URL
// query state, render the shell, filter the static registry. No database,
// no outage state, no invented rows.
export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const parsed = parseToolsQuery(await searchParams);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-lg bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">Tools</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            Plan like a pro
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Free planning calculators for organizers and teams. Everything runs in your
            browser — no account, no uploads, no payments.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ToolsFilters filters={parsed.filters} />
      </div>

      {parsed.invalid.length > 0 ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Some filters were invalid ({parsed.invalid.join(", ")}) and were ignored. Showing
          results for the remaining filters.
        </p>
      ) : null}

      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Loading tools…</p>}>
        <ToolsResults parsed={parsed} />
      </Suspense>
    </div>
  );
}
