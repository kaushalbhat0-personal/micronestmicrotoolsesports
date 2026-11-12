// Server-rendered GET form for /organizations: filtering works without
// JavaScript, the submitted URL is the shareable filter state, and every
// control is labelled. No recruitment-availability filter exists in this
// phase (no grounded recruitment data — inventing it would fabricate supply).

import Link from "next/link";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { ORG_TYPES, orgTypeLabel } from "@/features/organizations/domain/org-type";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import type { OrganizationFilters } from "../_lib/query";

export function OrganizationFiltersForm({ filters }: { filters: OrganizationFilters }) {
  return (
    <form
      method="get"
      action="/organizations"
      aria-label="Filter organizations"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="org-filter-query" className="text-sm font-medium">
          Search organizations
        </label>
        <input
          id="org-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Organization name or handle"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="org-filter-game" className="text-sm font-medium">
          Game
        </label>
        <select
          id="org-filter-game"
          name="game"
          defaultValue={filters.game ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All games</option>
          {SUPPORTED_GAMES.map((game) => (
            <option key={game.key} value={game.key}>
              {game.shortName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="org-filter-region" className="text-sm font-medium">
          Region
        </label>
        <select
          id="org-filter-region"
          name="region"
          defaultValue={filters.region ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All regions</option>
          {BGMI_REGION_VOCABULARY.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="org-filter-type" className="text-sm font-medium">
          Organization type
        </label>
        <select
          id="org-filter-type"
          name="type"
          defaultValue={filters.orgType ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All types</option>
          {ORG_TYPES.map((type) => (
            <option key={type} value={type}>
              {orgTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Apply filters
        </button>
        <Link
          href="/organizations"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
