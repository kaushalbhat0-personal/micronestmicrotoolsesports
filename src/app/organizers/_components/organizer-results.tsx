import Link from "next/link";
import {
  OrganizerDirectoryValidationError,
  type PublicOrganizerCard,
} from "@/features/organizers/domain/organizer";
import { searchOrganizers } from "@/features/organizers/server/organizer-reader";
import { createClient } from "@/lib/supabase/server";
import { OrganizerCard } from "./organizer-card";
import { OrganizersPagination } from "./organizers-pagination";
import {
  ORGANIZERS_PAGE_SIZE,
  toOrganizerSearchInput,
  type ParsedOrganizersQuery,
} from "../_lib/query";

// Async results block for /organizers (streams inside a Suspense boundary).
// Reads exclusively through OrganizerReader (PROPOSED masked RPC pair, local
// migration only): no base-table reads, no elevated client, no invented rows.
// Reader failures fail safely inline: vocabulary rejections render an
// explained empty state, transport failures (including the missing-function
// case) a retryable error state. Neither leaks which slugs exist.
export async function OrganizerResults({ parsed }: { parsed: ParsedOrganizersQuery }) {
  const client = await createClient();
  let cards: PublicOrganizerCard[] = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchOrganizers(client, toOrganizerSearchInput(parsed));
    hasMore = rows.length > ORGANIZERS_PAGE_SIZE;
    cards = rows.slice(0, ORGANIZERS_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof OrganizerDirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.organizerType !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No organizers match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/organizers"
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
        <h2 className="text-lg font-semibold">Organizer directory unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">Could not load organizers. Please try again.</p>
        <Link
          href="/organizers"
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
        <h2 className="text-lg font-semibold">No organizers found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No public organizers match these filters. Try widening your search."
            : "No public organizers are discoverable yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/organizers"
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
        Showing {cards.length} public {cards.length === 1 ? "organizer" : "organizers"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.slug}>
            <OrganizerCard card={card} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <OrganizersPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
