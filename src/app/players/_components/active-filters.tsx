// Active-filter chips for /players. Server-rendered links only: removing a
// chip navigates to the directory URL minus that filter (shareable, works
// without JavaScript). Renders nothing when no valid filter is active.

import Link from "next/link";
import { X } from "lucide-react";
import { buildDirectoryHref, type DirectoryFilters } from "../_lib/query";

const FILTER_LABELS = {
  query: "Search",
  game: "Game",
  region: "Region",
  role: "Role",
} as const;

type FilterKey = keyof typeof FILTER_LABELS;

function hrefWithout(filters: DirectoryFilters, omit: FilterKey) {
  const rest: DirectoryFilters = { ...filters };
  delete rest[omit];
  return buildDirectoryHref(rest, 1);
}

export function ActiveFilters({ filters }: { filters: DirectoryFilters }) {
  const active = (Object.keys(FILTER_LABELS) as Array<FilterKey>).filter(
    (key) => filters[key] !== undefined
  );
  if (active.length === 0) {
    return null;
  }
  return (
    <section aria-label="Active filters" className="mt-4">
      <ul className="flex flex-wrap items-center gap-2">
        {active.map((key) => (
          <li key={key}>
            <Link
              href={hrefWithout(filters, key)}
              aria-label={`Remove ${FILTER_LABELS[key]} filter ${filters[key]}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 border border-slate-deep/30 bg-paper px-3 text-sm font-medium text-ink-900 underline-offset-4 hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              <span className="text-xs font-bold tracking-[0.12em] text-ink-600 uppercase">
                {FILTER_LABELS[key]}:
              </span>
              <span className="max-w-44 truncate">{filters[key]}</span>
              <X aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/players"
            className="inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            Clear all
          </Link>
        </li>
      </ul>
    </section>
  );
}
