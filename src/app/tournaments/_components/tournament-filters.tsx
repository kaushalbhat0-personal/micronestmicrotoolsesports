// Server-rendered GET form for /tournaments: filtering works without
// JavaScript, the submitted URL is the shareable filter state, and every
// control is labelled. Game options come from the supported catalogue (BGMI
// only — P3 seeds no additional titles); region options are the BGMI
// vocabulary; status options are the three derived lifecycle buckets.
// Unknown values arriving via URL fail closed at the reader (zero rows,
// explained empty state).

import Link from "next/link";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { TOURNAMENT_STATUSES } from "@/features/tournaments/domain/tournament";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import type { TournamentFilters } from "../_lib/query";

interface TournamentFiltersProps {
  filters: TournamentFilters;
}

export function TournamentFilters({ filters }: TournamentFiltersProps) {
  return (
    <form
      method="get"
      action="/tournaments"
      aria-label="Filter tournaments"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="tournament-filter-query" className="text-sm font-medium">
          Search tournaments
        </label>
        <input
          id="tournament-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Tournament name"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="tournament-filter-game" className="text-sm font-medium">
          Game
        </label>
        <select
          id="tournament-filter-game"
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
        <label htmlFor="tournament-filter-region" className="text-sm font-medium">
          Region
        </label>
        <select
          id="tournament-filter-region"
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
        <label htmlFor="tournament-filter-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="tournament-filter-status"
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All statuses</option>
          {TOURNAMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Apply filters
        </button>
        <Link
          href="/tournaments"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
