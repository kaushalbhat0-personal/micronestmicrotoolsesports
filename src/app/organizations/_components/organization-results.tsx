import Link from "next/link";
import { OrganizationDirectoryValidationError } from "@/features/organizations/domain/organization";
import { searchOrganizations } from "@/features/organizations/server/organization-reader";
import { createClient } from "@/lib/supabase/server";
import { OrganizationCard } from "./organization-card";
import { OrganizationsPagination } from "./organizations-pagination";
import {
  ORGANIZATIONS_PAGE_SIZE,
  toOrganizationSearchInput,
  type ParsedOrganizationsQuery,
} from "../_lib/query";

// Async results block for /organizations (streams inside a Suspense boundary).
// Reads exclusively through OrganizationReader (PROPOSED masked RPC pair, no
// migration exists): no base-table reads, no elevated client, no invented rows.
// Reader failures fail safely inline: vocabulary rejections render an
// explained empty state, transport failures (including the missing-function
// case) a retryable error state. Neither leaks which slugs exist.
export async function OrganizationResults({ parsed }: { parsed: ParsedOrganizationsQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchOrganizations>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchOrganizations(client, toOrganizationSearchInput(parsed));
    hasMore = rows.length > ORGANIZATIONS_PAGE_SIZE;
    cards = rows.slice(0, ORGANIZATIONS_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof OrganizationDirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.orgType !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No organizations match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/organizations"
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
        <h2 className="text-lg font-semibold">Organization directory unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          Could not load organizations. Please try again.
        </p>
        <Link
          href="/organizations"
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
        <h2 className="text-lg font-semibold">No organizations found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No public organizations match these filters. Try widening your search."
            : "No public organizations are discoverable yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/organizations"
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
        Showing {cards.length} public {cards.length === 1 ? "organization" : "organizations"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.slug}>
            <OrganizationCard card={card} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <OrganizationsPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
