// Server-rendered GET form for /teams: filtering works without JavaScript,
// the submitted URL is the shareable filter state, and every control is
// labelled. Game options come from the supported catalogue (BGMI only —
// P1 ships no additional titles); region options are the BGMI vocabulary.
// Unknown game keys are never offered here, and unknown values arriving via
// URL fail closed at the reader (zero rows, explained empty state).

import Link from "next/link";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import type { TeamsFilters } from "../_lib/query";

interface TeamFiltersProps {
  filters: TeamsFilters;
}

export function TeamFilters({ filters }: TeamFiltersProps) {
  return (
    <form
      method="get"
      action="/teams"
      aria-label="Filter teams"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="team-filter-query" className="text-sm font-medium">
          Search teams
        </label>
        <input
          id="team-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Team name or slug"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="team-filter-game" className="text-sm font-medium">
          Game
        </label>
        <select
          id="team-filter-game"
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
        <label htmlFor="team-filter-region" className="text-sm font-medium">
          Region
        </label>
        <select
          id="team-filter-region"
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
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Apply filters
        </button>
        <Link
          href="/teams"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
