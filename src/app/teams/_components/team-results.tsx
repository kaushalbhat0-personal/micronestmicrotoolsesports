import Link from "next/link";
import { TeamDirectoryValidationError } from "@/features/teams/domain/team-directory";
import { searchTeams } from "@/features/teams/server/team-directory-reader";
import { createClient } from "@/lib/supabase/server";
import { TeamCard } from "./team-card";
import { TeamsPagination } from "./teams-pagination";
import { TEAMS_PAGE_SIZE, toTeamSearchInput, type ParsedTeamsQuery } from "../_lib/query";

// Async results block for /teams (streams inside a Suspense boundary so the
// directory shell paints first). Reads exclusively through TeamDirectoryReader
// (D1 masked RPC pair, UNAPPLIED): no base-table reads, no elevated database
// client, no new RPCs. Reader failures fail safely inline: vocabulary
// rejections render an explained empty state, transport failures (including
// the pending-migration missing-function case) a retryable error state.
// Neither leaks which slugs exist. No rows are ever invented.
export async function TeamResults({ parsed }: { parsed: ParsedTeamsQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchTeams>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchTeams(client, toTeamSearchInput(parsed));
    hasMore = rows.length > TEAMS_PAGE_SIZE;
    cards = rows.slice(0, TEAMS_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof TeamDirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No teams match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/teams"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Reset filters
        </Link>
      </div>
    );
  }

  if (readerError === "unavailable") {
    return (
      <div
        role="alert"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center"
      >
        <h2 className="text-lg font-semibold">Team directory unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          Could not load the team directory. Please try again.
        </p>
        <Link
          href="/teams"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No teams found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No public teams match these filters. Try widening your search."
            : "No public teams are discoverable yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/teams"
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
        Showing {cards.length} public {cards.length === 1 ? "team" : "teams"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.slug}>
            <TeamCard card={card} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <TeamsPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
