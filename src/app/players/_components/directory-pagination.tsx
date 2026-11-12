import Link from "next/link";
import { buildDirectoryHref, type DirectoryFilters } from "../_lib/query";

interface DirectoryPaginationProps {
  page: number;
  hasMore: boolean;
  filters: DirectoryFilters;
}

const linkClassName =
  "inline-flex min-h-[44px] items-center justify-center border border-ink-900/30 bg-paper px-4 text-sm font-bold tracking-wide text-ink-900 uppercase hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

const disabledClassName =
  "inline-flex min-h-[44px] cursor-not-allowed items-center justify-center border border-slate-deep/15 px-4 text-sm font-medium text-slate-mid";

// Pagination preserves exactly the valid filters (shareable URLs). No page
// numbers or totals are exposed (counts derive from the projection only):
// Previous / Next with an honest current-page label.
export function DirectoryPagination({ page, hasMore, filters }: DirectoryPaginationProps) {
  const previousHref = page > 1 ? buildDirectoryHref(filters, page - 1) : null;
  const nextHref = hasMore ? buildDirectoryHref(filters, page + 1) : null;
  return (
    <nav aria-label="Player directory pages" className="flex flex-wrap items-center gap-3">
      {previousHref === null ? (
        <span aria-disabled="true" className={disabledClassName}>
          Previous
        </span>
      ) : (
        <Link href={previousHref} rel="prev" className={linkClassName}>
          Previous
        </Link>
      )}
      <span aria-current="page" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-900">
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
