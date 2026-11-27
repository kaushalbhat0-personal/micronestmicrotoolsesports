import Link from "next/link";
import { buildTeamsHref, type TeamsFilters } from "../_lib/query";

interface TeamsPaginationProps {
  page: number;
  hasMore: boolean;
  filters: TeamsFilters;
}

const linkClassName =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

const disabledClassName =
  "cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-400";

// Pagination preserves exactly the valid filters (shareable URLs). No page
// numbers or totals are exposed (counts derive from the projection only).
export function TeamsPagination({ page, hasMore, filters }: TeamsPaginationProps) {
  const previousHref = page > 1 ? buildTeamsHref(filters, page - 1) : null;
  const nextHref = hasMore ? buildTeamsHref(filters, page + 1) : null;
  return (
    <nav aria-label="Team directory pages" className="flex items-center gap-3">
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
