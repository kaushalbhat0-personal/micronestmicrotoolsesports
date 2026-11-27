import Link from "next/link";
import { TOOL_REGISTRY, toolMatchesGame } from "@/features/tools/catalog";
import { ToolCard } from "./tool-card";
import type { ParsedToolsQuery } from "../_lib/query";

// Static results for /tools. The catalogue is an in-code registry — no
// database, no outage state, no invented rows. Filters only narrow the
// static list; unknown-but-shaped game values match platform-wide tools
// (game-agnostic math runs anywhere) while game-specific tools stay hidden.
export function ToolsResults({ parsed }: { parsed: ParsedToolsQuery }) {
  const query = parsed.filters.query?.trim().toLowerCase();
  const cards = TOOL_REGISTRY.filter((tool) => {
    if (!toolMatchesGame(tool, parsed.filters.game)) {
      return false;
    }
    if (parsed.filters.category !== undefined && tool.category !== parsed.filters.category) {
      return false;
    }
    if (query !== undefined && query !== "") {
      const haystack = `${tool.name} ${tool.tagline} ${tool.description}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.category !== undefined ||
    parsed.filters.query !== undefined;

  if (cards.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No tools found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No tools match these filters. Try widening your search."
            : "No tools are listed yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/tools"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-slate-600">
        Showing {cards.length} {cards.length === 1 ? "tool" : "tools"}.
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.map((tool) => (
          <li key={tool.slug}>
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </div>
  );
}
