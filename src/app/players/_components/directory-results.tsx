import Link from "next/link";
import { DirectoryValidationError } from "@/features/player-profile/domain/directory";
import { searchDirectory } from "@/features/player-profile/server/directory-reader";
import { createClient } from "@/lib/supabase/server";
import { PlayerCard } from "./player-card";
import { DirectoryPagination } from "./directory-pagination";
import { DIRECTORY_PAGE_SIZE, toDirectoryInput, type ParsedDirectoryQuery } from "../_lib/query";

const panelClass = "mt-6 border border-slate-deep/20 bg-paper p-6 text-center sm:p-8";

// Async results block for /players (streams inside a Suspense boundary so the
// directory shell paints first). Reads exclusively through DirectoryReader
// (APPROVED D-G1-03 RPC-only). Reader failures fail safely inline: vocabulary
// rejections render an explained empty state, transport failures a retryable
// error state. Neither leaks which handles exist.
export async function DirectoryResults({ parsed }: { parsed: ParsedDirectoryQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchDirectory>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchDirectory(client, toDirectoryInput(parsed));
    hasMore = rows.length > DIRECTORY_PAGE_SIZE;
    cards = rows.slice(0, DIRECTORY_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof DirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.role !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className={panelClass}>
        <h2 className="font-display text-xl font-extrabold tracking-tight uppercase">
          No players match
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/players"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center bg-arena-950 px-6 text-sm font-bold tracking-wide text-white uppercase hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Reset filters
        </Link>
      </div>
    );
  }

  if (readerError === "unavailable") {
    return (
      <div role="alert" className={panelClass}>
        <h2 className="font-display text-xl font-extrabold tracking-tight uppercase">
          Directory unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          Could not load the player directory. Please try again.
        </p>
        <Link
          href="/players"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center bg-arena-950 px-6 text-sm font-bold tracking-wide text-white uppercase hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Try again
        </Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div role="status" className={panelClass}>
        <h2 className="font-display text-xl font-extrabold tracking-tight uppercase">
          No players found
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          {hasActiveFilters
            ? "No public profiles match these filters. Try widening your search."
            : "No public player profiles are discoverable yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/players"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center bg-arena-950 px-6 text-sm font-bold tracking-wide text-white uppercase hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            Clear filters
          </Link>
        ) : (
          <Link
            href="/about"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center border border-ink-900/30 px-6 text-sm font-bold tracking-wide text-ink-900 uppercase hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            How opt-in discovery works
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-ink-600">
        Showing {cards.length} public {cards.length === 1 ? "profile" : "profiles"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      <ul className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <li key={`${card.handle}:${card.game_key}`} className="min-w-0">
            <PlayerCard card={card} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <DirectoryPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
