import Link from "next/link";
import { buildOrganizationsHref, type OrganizationFilters } from "../_lib/query";

interface OrganizationsPaginationProps {
  page: number;
  hasMore: boolean;
  filters: OrganizationFilters;
}

const linkClassName =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

const disabledClassName =
  "cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-400";

export function OrganizationsPagination({ page, hasMore, filters }: OrganizationsPaginationProps) {
  const previousHref = page > 1 ? buildOrganizationsHref(filters, page - 1) : null;
  const nextHref = hasMore ? buildOrganizationsHref(filters, page + 1) : null;
  return (
    <nav aria-label="Organization directory pages" className="flex items-center gap-3">
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
