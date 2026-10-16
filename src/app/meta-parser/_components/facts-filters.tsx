import * as React from "react";
import { CHANGE_TYPE_FILTER_OPTIONS } from "../_lib/facts";
import { sectionsForEntityTypes } from "../_lib/presentation-taxonomy";

/**
 * Patch-page filters (server-rendered, no client JS).
 *
 * Plain-language labels over unchanged URL keys: What changed? →
 * `entity_type`, Change type → `change_type`, Search → `entity`. Section
 * options come from the presentation taxonomy applied to the patch's own
 * published entity types — never a universal hardcoded list. Submits as a
 * normal GET form, preserving the existing query-string flow and
 * shareable URLs.
 */
export function FactsFilters({
  basePath,
  gameSlug,
  entityType,
  changeType,
  entity,
  entityTypes,
  entityNames,
  searchPlaceholder,
  hasFilters,
}: {
  basePath: string;
  gameSlug: string;
  entityType: string | null;
  changeType: string | null;
  entity: string | null;
  entityTypes: readonly string[];
  entityNames: readonly string[];
  searchPlaceholder: string;
  hasFilters: boolean;
}) {
  const sectionOptions = sectionsForEntityTypes(gameSlug, entityTypes);
  return (
    <form method="get" action={basePath} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="facts-category" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          What changed?
        </label>
        <select
          id="facts-category"
          name="entity_type"
          defaultValue={entityType ?? ""}
          className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All</option>
          {sectionOptions.map((option) => (
            <option key={option.sectionKey} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="facts-change" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Change type
        </label>
        <select
          id="facts-change"
          name="change_type"
          defaultValue={changeType ?? ""}
          className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All changes</option>
          {CHANGE_TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="facts-search" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Search
        </label>
        <input
          id="facts-search"
          name="entity"
          type="search"
          defaultValue={entity ?? ""}
          placeholder={searchPlaceholder}
          autoComplete="off"
          list="facts-search-suggestions"
          className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <datalist id="facts-search-suggestions">
          {entityNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
        >
          Apply filters
        </button>
        {hasFilters ? (
          <a
            href={basePath}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </a>
        ) : null}
      </div>
    </form>
  );
}
