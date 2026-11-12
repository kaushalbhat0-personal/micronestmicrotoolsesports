// Public news result card. Renders ONLY public directory fields:
// headline/slug link, category badge, summary/excerpt, game marker, reading
// time, published date, byline. No body, no source URL, no revision
// history, no verification badges.

import Link from "next/link";
import type { PublicArticleCard } from "@/features/news/domain/public-card";
import { NewsCategoryBadge, NewsMeta } from "./news-bits";

export function NewsCard({ card, featured = false }: { card: PublicArticleCard; featured?: boolean }) {
  const headingId = `news-${card.slug}-headline`;
  return (
    <article
      aria-labelledby={headingId}
      className={
        featured
          ? "overflow-hidden rounded-lg border border-slate-200 bg-white"
          : "rounded-lg border border-slate-200 bg-white p-4"
      }
    >
      {featured ? (
        <div className="bg-arena-950 px-4 py-8 text-white sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">
            Featured story
          </p>
          <h3 id={headingId} className="font-display mt-2 text-2xl font-extrabold tracking-tight uppercase sm:text-3xl">
            <Link
              href={`/news/${card.slug}`}
              className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {card.headline}
            </Link>
          </h3>
          <div className="mt-3">
            <NewsCategoryBadge category={card.category} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={headingId} className="min-w-0 flex-1 text-base font-semibold">
            <Link
              href={`/news/${card.slug}`}
              className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {card.headline}
            </Link>
          </h3>
          <NewsCategoryBadge category={card.category} />
        </div>
      )}
      <div className={featured ? "px-4 py-4 sm:px-6" : undefined}>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          {card.summary}
        </p>
        <NewsMeta
          gameKey={card.game_key}
          readingMinutes={card.reading_minutes}
          publishedAt={card.published_at}
        />
        <p className="mt-1 text-xs text-slate-500">By {card.author_display_name}</p>
      </div>
    </article>
  );
}
