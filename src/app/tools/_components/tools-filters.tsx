// Server-rendered GET form for /tools: filtering works without JavaScript,
// the submitted URL is the shareable filter state, and every control is
// labelled. The category select lists only categories present in the
// registry (never an empty promise); the game select lists supported titles
// plus platform-wide coverage. Unknown values arriving via URL fail safe.

import Link from "next/link";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import {
  TOOL_CATEGORIES,
  TOOL_REGISTRY,
  toolCategoryLabel,
} from "@/features/tools/catalog";
import type { ToolsFilters } from "../_lib/query";

interface ToolsFiltersProps {
  filters: ToolsFilters;
}

export function ToolsFilters({ filters }: ToolsFiltersProps) {
  const populatedCategories = TOOL_CATEGORIES.filter((category) =>
    TOOL_REGISTRY.some((tool) => tool.category === category),
  );
  return (
    <form
      method="get"
      action="/tools"
      aria-label="Filter tools"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="tools-filter-query" className="text-sm font-medium">
          Search tools
        </label>
        <input
          id="tools-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Tool name or purpose"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      {populatedCategories.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="tools-filter-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="tools-filter-category"
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
          >
            <option value="">All categories</option>
            {populatedCategories.map((category) => (
              <option key={category} value={category}>
                {toolCategoryLabel(category)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="tools-filter-game" className="text-sm font-medium">
          Game
        </label>
        <select
          id="tools-filter-game"
          name="game"
          defaultValue={filters.game ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All games + platform-wide</option>
          {SUPPORTED_GAMES.map((game) => (
            <option key={game.key} value={game.key}>
              {game.shortName}
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
          href="/tools"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
