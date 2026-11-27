import Link from "next/link";
import { BrandDirectoryValidationError } from "@/features/brands/domain/brand";
import { searchBrands } from "@/features/brands/server/brand-reader";
import { createClient } from "@/lib/supabase/server";
import { BrandCard } from "./brand-card";
import { BrandsPagination } from "./brands-pagination";
import {
  BRANDS_PAGE_SIZE,
  toBrandSearchInput,
  type ParsedBrandsQuery,
} from "../_lib/query";

// Async results block for /brands (streams inside a Suspense boundary).
// Reads exclusively through BrandReader (PROPOSED masked RPC pair, no
// migration exists): no base-table reads, no elevated client, no invented
// rows. Vocabulary rejections render an explained empty state; transport
// failures (including the missing-function case) a retryable error state.
export async function BrandResults({ parsed }: { parsed: ParsedBrandsQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchBrands>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchBrands(client, toBrandSearchInput(parsed));
    hasMore = rows.length > BRANDS_PAGE_SIZE;
    cards = rows.slice(0, BRANDS_PAGE_SIZE);
  } catch (error) {
    readerError = error instanceof BrandDirectoryValidationError ? "invalid" : "unavailable";
  }

  const hasActiveFilters =
    parsed.filters.gameInterest !== undefined ||
    parsed.filters.industry !== undefined ||
    parsed.filters.region !== undefined ||
    parsed.filters.interest !== undefined ||
    parsed.filters.partnership !== undefined ||
    parsed.filters.query !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No brands match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/brands"
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
        <h2 className="text-lg font-semibold">Brand directory unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">Could not load brands. Please try again.</p>
        <Link
          href="/brands"
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
        <h2 className="text-lg font-semibold">No brands found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No public brands match these filters. Try widening your search."
            : "No public brands are discoverable yet."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/brands"
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
        Showing {cards.length} public {cards.length === 1 ? "brand" : "brands"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.slug}>
            <BrandCard card={card} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <BrandsPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
