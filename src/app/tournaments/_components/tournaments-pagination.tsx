import Link from "next/link";
import { buildTournamentsHref, type TournamentFilters } from "../_lib/query";

interface TournamentsPaginationProps {
  page: number;
  hasMore: boolean;
  filters: TournamentFilters;
}

const linkClassName =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

const disabledClassName =
  "cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-400";

// Pagination preserves exactly the valid filters (shareable URLs). No page
// numbers or totals are exposed (counts derive from the projection only).
export function TournamentsPagination({ page, hasMore, filters }: TournamentsPaginationProps) {
  const previousHref = page > 1 ? buildTournamentsHref(filters, page - 1) : null;
  const nextHref = hasMore ? buildTournamentsHref(filters, page + 1) : null;
  return (
    <nav aria-label="Tournament directory pages" className="flex items-center gap-3">
      {previousHref === null ? (
        <span aria-disabled="true" className={disabledClassName}>
          Previous
        </span>
      ) : (
        <Link href={previousHref} rel="prev" className={linkClassName}>
          Previous
        </Link>
      )}
      <span aria-current="page" className="text-sm text-slate-600">
        Page {page}
      </span>
      {nextHref === null ? (
        <span aria-disabled="true" className={disabledClassName}>
          Next
        </span>
      ) : (
        <Link href={nextHref} rel="next" className={linkClassName}>
          Next
        </Link>
      )}
    </nav>
  );
}
