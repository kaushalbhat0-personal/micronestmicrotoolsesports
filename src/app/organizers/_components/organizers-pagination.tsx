import Link from "next/link";
import { buildOrganizersHref, type OrganizerFilters } from "../_lib/query";

// Bounded pagination for /organizers: page-only URLs, no total counts (the
// reader over-reads by one to detect a next page). Page 1 omits the param.
export function OrganizersPagination({
  page,
  hasMore,
  filters,
}: {
  page: number;
  hasMore: boolean;
  filters: OrganizerFilters;
}) {
  const prev = page > 1 ? buildOrganizersHref(filters, page - 1) : null;
  const next = hasMore ? buildOrganizersHref(filters, page + 1) : null;
  if (prev === null && next === null) {
    return null;
  }
  return (
    <nav aria-label="Organizer directory pages" className="flex items-center gap-2">
      {prev !== null ? (
        <Link
          href={prev}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Previous
        </Link>
      ) : null}
      <span className="text-sm text-slate-500" role="status">
        Page {page}
      </span>
      {next !== null ? (
        <Link
          href={next}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
