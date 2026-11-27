import Link from "next/link";
import type { NewsFilters } from "../_lib/query";
import { buildNewsHref } from "../_lib/query";

export function NewsPagination({
  page,
  hasMore,
  filters,
}: {
  page: number;
  hasMore: boolean;
  filters: NewsFilters;
}) {
  const prev = page > 1 ? buildNewsHref(filters, page - 1) : null;
  const next = hasMore ? buildNewsHref(filters, page + 1) : null;
  if (prev === null && next === null) {
    return null;
  }
  return (
    <nav aria-label="News pages" className="flex items-center justify-between gap-3">
      {prev !== null ? (
        <Link
          href={prev}
          rel="prev"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Newer stories
        </Link>
      ) : (
        <span />
      )}
      <p className="text-xs text-slate-500">Page {page}</p>
      {next !== null ? (
        <Link
          href={next}
          rel="next"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Older stories →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
