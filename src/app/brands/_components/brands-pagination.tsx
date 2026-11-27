import Link from "next/link";
import { buildBrandsHref, type BrandFilters } from "../_lib/query";

interface BrandsPaginationProps {
  page: number;
  hasMore: boolean;
  filters: BrandFilters;
}

const linkClassName =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

const disabledClassName =
  "cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-400";

export function BrandsPagination({ page, hasMore, filters }: BrandsPaginationProps) {
  const previousHref = page > 1 ? buildBrandsHref(filters, page - 1) : null;
  const nextHref = hasMore ? buildBrandsHref(filters, page + 1) : null;
  return (
    <nav aria-label="Brand directory pages" className="flex items-center gap-3">
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
