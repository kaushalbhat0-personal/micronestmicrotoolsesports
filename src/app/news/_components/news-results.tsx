import Link from "next/link";
import {
  NewsDirectoryOperationError,
  NewsDirectoryValidationError,
} from "@/features/news/domain/public-card";
import { searchArticles } from "@/features/news/server/article-reader";
import { createClient } from "@/lib/supabase/server";
import { NewsCard } from "./news-card";
import { NewsPagination } from "./news-pagination";
import { NEWS_PAGE_SIZE, toArticleSearchInput, type ParsedNewsQuery } from "../_lib/query";

// Async results block for /news (streams inside a Suspense boundary so the
// directory shell paints first). Reads exclusively through
// ArticleReader.searchArticles (PROPOSED masked RPC pair, no migration
// exists): no base-table reads, no elevated database client, no new RPCs, no
// invented rows. Reader failures fail safely inline: vocabulary rejections
// render an explained empty state, transport failures (including the
// proposed-RPC missing-function case) a retryable unavailable state. Neither
// leaks which slugs exist.
//
// Sections: without a category filter the page slice is grouped into
// Featured (first story) + Latest (remainder); with a category filter the
// list renders flat. Grouping is presentation of the fetched page only.
export async function NewsResults({ parsed }: { parsed: ParsedNewsQuery }) {
  const client = await createClient();
  let cards: Awaited<ReturnType<typeof searchArticles>> = [];
  let hasMore = false;
  let readerError: "invalid" | "unavailable" | null = null;
  try {
    const rows = await searchArticles(client, toArticleSearchInput(parsed));
    hasMore = rows.length > NEWS_PAGE_SIZE;
    cards = rows.slice(0, NEWS_PAGE_SIZE);
  } catch (error) {
    if (error instanceof NewsDirectoryValidationError) {
      readerError = "invalid";
    } else if (error instanceof NewsDirectoryOperationError) {
      readerError = "unavailable";
    } else {
      readerError = "unavailable";
    }
  }

  const hasActiveFilters =
    parsed.filters.game !== undefined ||
    parsed.filters.category !== undefined ||
    parsed.filters.query !== undefined ||
    parsed.filters.tag !== undefined;

  if (readerError === "invalid") {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">No stories match</h2>
        <p className="mt-2 text-sm text-slate-600">
          This filter combination is not available. Try different filters.
        </p>
        <Link
          href="/news"
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
        <h2 className="text-lg font-semibold">News unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          Could not load stories. Please try again.
        </p>
        <Link
          href="/news"
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
        <h2 className="text-lg font-semibold">No stories found</h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? "No stories match these filters. Try widening your search."
            : "No stories are published yet. Check back soon."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/news"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    );
  }

  const grouped = parsed.filters.category === undefined;
  const [featured, ...latest] = cards;

  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-slate-600">
        Showing {cards.length} {cards.length === 1 ? "story" : "stories"}
        {parsed.page > 1 ? ` · page ${parsed.page}` : ""}.
      </p>
      {grouped && featured ? (
        <div className="mt-4 space-y-8">
          <NewsCard card={featured} featured />
          {latest.length > 0 ? (
            <section aria-labelledby="news-latest-heading">
              <h2
                id="news-latest-heading"
                className="font-display text-lg font-extrabold tracking-tight uppercase"
              >
                Latest
              </h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {latest.map((card) => (
                  <li key={card.slug}>
                    <NewsCard card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <li key={card.slug}>
              <NewsCard card={card} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <NewsPagination page={parsed.page} hasMore={hasMore} filters={parsed.filters} />
      </div>
    </div>
  );
}
