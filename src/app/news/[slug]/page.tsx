import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  NewsDirectoryOperationError,
  NewsDirectoryValidationError,
} from "@/features/news/domain/public-card";
import { getArticleBySlug } from "@/features/news/server/article-reader";
import { createClient } from "@/lib/supabase/server";
import { NewsDetail } from "../_components/news-detail";
import { RelatedStories } from "../_components/related-stories";
import { searchArticles } from "@/features/news/server/article-reader";
import {
  buildNewsCanonicalUrl,
  buildNewsDetailMetadata,
  buildNewsNotFoundMetadata,
  buildNewsUnavailableMetadata,
} from "../_lib/query";

type SlugParams = { slug: string };

// Seconds-scale revalidation: unpublishing hides the row on the next query;
// short caching bounds stale public pages without revalidating on every
// request (same posture as the tournament detail route).
export const revalidate = 60;

// Public news detail (P4). Resolves the slug through getArticleBySlug only
// (PROPOSED masked RPC, no migration exists): no base-table reads, no
// elevated database client, no new RPCs. Missing and unpublished slugs
// return the identical generic not-found (404-equivalence). Reader outages
// (including the proposed-RPC missing case) render an intentional
// unavailable state inline — never a 500 with internal detail, never a
// misleading not-found.
export async function generateMetadata({
  params,
}: {
  params: Promise<SlugParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  try {
    const card = await getArticleBySlug(client, slug);
    if (card === null) {
      const notFoundCopy = buildNewsNotFoundMetadata();
      return {
        title: notFoundCopy.title,
        description: notFoundCopy.description,
        robots: { index: false, follow: true },
      };
    }
    const copy = buildNewsDetailMetadata(card);
    return {
      title: copy.title,
      description: copy.description,
      robots: { index: false, follow: true },
      ...(buildNewsCanonicalUrl(`/news/${card.slug}`) === undefined
        ? {}
        : { alternates: { canonical: buildNewsCanonicalUrl(`/news/${card.slug}`) } }),
    };
  } catch (error) {
    if (error instanceof NewsDirectoryOperationError) {
      const unavailableCopy = buildNewsUnavailableMetadata();
      return {
        title: unavailableCopy.title,
        description: unavailableCopy.description,
        robots: { index: false, follow: true },
      };
    }
    // Invalid slug syntax exposes the same generic not-found copy (no
    // existence oracle).
    const notFoundCopy = buildNewsNotFoundMetadata();
    return {
      title: notFoundCopy.title,
      description: notFoundCopy.description,
      robots: { index: false, follow: true },
    };
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<SlugParams> }) {
  const { slug } = await params;
  const client = await createClient();
  let card: Awaited<ReturnType<typeof getArticleBySlug>>;
  try {
    card = await getArticleBySlug(client, slug);
  } catch (error) {
    // Invalid syntax is indistinguishable from missing (no existence oracle);
    // reader outages render the intentional unavailable state inline.
    if (error instanceof NewsDirectoryValidationError) {
      notFound();
    }
    if (error instanceof NewsDirectoryOperationError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <p className="mb-6 text-sm">
            <Link
              href="/news"
              className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              ← Back to news
            </Link>
          </p>
          <div
            role="alert"
            className="rounded-lg border border-slate-200 bg-white p-6 text-center"
          >
            <h1 className="text-lg font-semibold">Story unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              Could not load this story. Please try again.
            </p>
            <Link
              href="/news"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to news
            </Link>
          </div>
        </div>
      );
    }
    throw error;
  }
  if (card === null) {
    notFound();
  }
  let related: Awaited<ReturnType<typeof searchArticles>> = [];
  try {
    related = await searchArticles(client, {
      game: card.game_key ?? undefined,
      limit: 4,
      offset: 0,
    });
  } catch {
    related = [];
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/news"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to news
        </Link>
      </p>
      <NewsDetail card={card} />
      <RelatedStories current={card} candidates={related} />
    </div>
  );
}
