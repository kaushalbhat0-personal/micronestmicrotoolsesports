import Link from "next/link";
import { TournamentDirectoryValidationError } from "@/features/tournaments/domain/public-card";
import { searchTournaments } from "@/features/tournaments/server/tournament-reader";
import { createClient } from "@/lib/supabase/server";
import { TournamentCard } from "./tournament-card";
import { TournamentsPagination } from "./tournaments-pagination";
import {
  TOURNAMENTS_PAGE_SIZE,
  toTournamentSearchInput,
  type ParsedTournamentsQuery,
} from "../_lib/query";

// Async results block for /tournaments (streams inside a Suspense boundary
// so the directory shell paints first). Reads exclusively through
// TournamentReader (PROPOSED masked RPC pair, no migration exists): no
// base-table reads, no elevated database client, no new RPCs, no invented
// rows. Reader failures fail safely inline: vocabulary rejections render an
// explained empty state, transport failures (including the proposed-RPC
// missing-function case) a retryable error state. Neither leaks which slugs
// exist.
//
// Sections: without a status filter the page slice is grouped into
// Upcoming / Ongoing / Completed sections; with a status filter the list
// renders flat. Grouping is presentation of the fetched page only.
export async function TournamentResults({ parsed }: { parsed: ParsedTournamentsQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchTournaments>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchTournaments(client, toTournamentSearchInput(parsed));
    hasMore = rows.length > TOURNAMENTS_PAGE_SIZE;
    cards = rows.slice(0, TOURNAMENTS_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof TournamentDirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.status !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No tournaments match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/tournaments"
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
        <h2 className="text-lg font-semibold">Tournament directory unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          Could not load tournaments. Please try again.
        </p>
        <Link
          href="/tournaments"
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
        <h2 className="text-lg font-semibold">No tournaments found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No tournaments match these filters. Try widening your search."
            : "No tournaments are listed yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/tournaments"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    );
  }

  const grouped = parsed.filters.status === undefined;
  const sections =
    grouped
      ? (
          [
            { status: "upcoming", title: "Upcoming" },
            { status: "ongoing", title: "Ongoing" },
            { status: "completed", title: "Completed" },
          ] as const
        )
          .map((section) => ({
            ...section,
            cards: cards.filter((card) => card.status === section.status),
          }))
          .filter((section) => section.cards.length > 0)
      : [];

  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-slate-600">
        Showing {cards.length} {cards.length === 1 ? "tournament" : "tournaments"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      {grouped ? (
        <div className="mt-4 space-y-8">
          {sections.map((section) => (
            <section key={section.status} aria-labelledby={`tournaments-${section.status}`}>
              <h2
                id={`tournaments-${section.status}`}
                className="font-display text-lg font-extrabold tracking-tight uppercase"
              >
                {section.title}
              </h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {section.cards.map((card) => (
                  <li key={card.slug}>
                    <TournamentCard card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <li key={card.slug}>
              <TournamentCard card={card} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <TournamentsPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
