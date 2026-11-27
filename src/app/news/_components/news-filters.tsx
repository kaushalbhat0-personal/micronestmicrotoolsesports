// Server-rendered GET form for /news: filtering works without JavaScript,
// the submitted URL is the shareable filter state, and every control is
// labelled. Game options come from the supported catalogue (BGMI only — P4
// seeds no additional titles); category options are the frozen editorial
// vocabulary. Unknown values arriving via URL fail closed at the reader
// (zero rows, explained empty state).

import Link from "next/link";
import { ARTICLE_CATEGORIES, articleCategoryLabel } from "@/features/news/domain/article";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import type { NewsFilters } from "../_lib/query";

interface NewsFiltersProps {
  filters: NewsFilters;
}

export function NewsFilters({ filters }: NewsFiltersProps) {
  return (
    <form
      method="get"
      action="/news"
      aria-label="Filter news"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="flex flex-col gap-1 lg:col-span-2">
        <label htmlFor="news-filter-query" className="text-sm font-medium">
          Search stories
        </label>
        <input
          id="news-filter-query"
          name="query"
          type="search"
          autoComplete="off"
          maxLength={120}
          placeholder="Headline or topic"
          defaultValue={filters.query ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="news-filter-game" className="text-sm font-medium">
          Game
        </label>
        <select
          id="news-filter-game"
          name="game"
          defaultValue={filters.game ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All coverage</option>
          {SUPPORTED_GAMES.map((game) => (
            <option key={game.key} value={game.key}>
              {game.shortName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="news-filter-category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="news-filter-category"
          name="category"
          defaultValue={filters.category ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        >
          <option value="">All categories</option>
          {ARTICLE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {articleCategoryLabel(category)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="news-filter-tag" className="text-sm font-medium">
          Tag
        </label>
        <input
          id="news-filter-tag"
          name="tag"
          type="search"
          autoComplete="off"
          maxLength={32}
          placeholder="e.g. roster"
          defaultValue={filters.tag ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
        />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Apply filters
        </button>
        <Link
          href="/news"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Reset filters
        </Link>
      </div>
    </form>
  );
}
