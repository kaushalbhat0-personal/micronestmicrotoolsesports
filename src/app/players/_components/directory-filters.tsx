import Link from "next/link";
import { BGMI_ROLES, BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import type { DirectoryFilters } from "../_lib/query";

interface DirectoryFiltersProps {
  filters: DirectoryFilters;
}

// Server-rendered GET form: filtering works without JavaScript, the submitted
// URL is the shareable filter state, and every control is labelled. Only
// reader-supported vocabularies are offered (BGMI game/region/role + search);
// no format, availability or sort controls exist because the reader contract
// has no fields for them.
export function DirectoryFilters({ filters }: { filters: DirectoryFiltersProps["filters"] }) {
  return (
    <form
      method="get"
      action="/players"
      aria-label="Filter players"
      className="grid gap-4 border border-slate-deep/20 bg-paper p-4 sm:p-6 lg:grid-cols-12"
    >
      <div className="flex flex-col gap-1.5 lg:col-span-4">
        <label
          htmlFor="filter-query"
          className="text-[11px] font-bold tracking-[0.14em] text-ink-600 uppercase"
        >
          Search players
        </label>
        <input
          id="filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Handle, name or IGN"
          defaultValue={filters.query ?? ""}
          className="min-h-[44px] border border-slate-deep/30 bg-paper px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-game"
            className="text-[11px] font-bold tracking-[0.14em] text-ink-600 uppercase"
          >
            Game
          </label>
          <select
            id="filter-game"
            name="game"
            defaultValue={filters.game ?? ""}
            className="min-h-[44px] border border-slate-deep/30 bg-paper px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
          >
            <option value="">All games</option>
            <option value="bgmi">BGMI</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-region"
            className="text-[11px] font-bold tracking-[0.14em] text-ink-600 uppercase"
          >
            Region
          </label>
          <select
            id="filter-region"
            name="region"
            defaultValue={filters.region ?? ""}
            className="min-h-[44px] border border-slate-deep/30 bg-paper px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
          >
            <option value="">All regions</option>
            {BGMI_REGION_VOCABULARY.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-role"
            className="text-[11px] font-bold tracking-[0.14em] text-ink-600 uppercase"
          >
            Role
          </label>
          <select
            id="filter-role"
            name="role"
            defaultValue={filters.role ?? ""}
            className="min-h-[44px] border border-slate-deep/30 bg-paper px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
          >
            <option value="">All roles</option>
            {BGMI_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:col-span-12">
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center bg-arena-950 px-6 text-sm font-bold tracking-wide text-white uppercase hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Apply filters
        </button>
        <Link
          href="/players"
          className="inline-flex min-h-[44px] items-center justify-center border border-ink-900/30 px-6 text-sm font-bold tracking-wide text-ink-900 uppercase hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
