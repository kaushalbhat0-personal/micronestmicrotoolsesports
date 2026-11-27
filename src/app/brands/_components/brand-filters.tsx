// Server-rendered GET form for /brands. The `interest` filter selects
// DECLARED sponsorship interest only — never availability. No filter claims a
// brand is looking for partners.

import Link from "next/link";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import {
  BRAND_INDUSTRIES,
  PARTNERSHIP_TYPES,
  SPONSORSHIP_INTERESTS,
} from "@/features/brands/domain/vocabulary";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import type { BrandFilters } from "../_lib/query";

export function BrandFiltersForm({ filters }: { filters: BrandFilters }) {
  return (
    <form
      method="get"
      action="/brands"
      aria-label="Filter brands"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="brand-filter-query" className="text-sm font-medium">
          Search brands
        </label>
        <input
          id="brand-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Brand name or handle"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="brand-filter-game" className="text-sm font-medium">
          Game interest
        </label>
        <select
          id="brand-filter-game"
          name="game"
          defaultValue={filters.gameInterest ?? ""}
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
        <label htmlFor="brand-filter-industry" className="text-sm font-medium">
          Industry
        </label>
        <select
          id="brand-filter-industry"
          name="industry"
          defaultValue={filters.industry ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All industries</option>
          {BRAND_INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="brand-filter-region" className="text-sm font-medium">
          Region
        </label>
        <select
          id="brand-filter-region"
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
        <label htmlFor="brand-filter-interest" className="text-sm font-medium">
          Sponsorship interest
        </label>
        <select
          id="brand-filter-interest"
          name="interest"
          defaultValue={filters.interest ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All interests</option>
          {SPONSORSHIP_INTERESTS.map((interest) => (
            <option key={interest} value={interest}>
              {interest}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="brand-filter-partnership" className="text-sm font-medium">
          Partnership type
        </label>
        <select
          id="brand-filter-partnership"
          name="partnership"
          defaultValue={filters.partnership ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All types</option>
          {PARTNERSHIP_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Apply filters
        </button>
        <Link
          href="/brands"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
