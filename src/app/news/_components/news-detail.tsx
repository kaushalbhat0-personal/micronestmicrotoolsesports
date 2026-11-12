// Public news detail presentation. Renders ONLY public detail fields with
// a magazine-style hierarchy: dark editorial banner (CSS-only arena panel —
// no stock imagery, no fabricated media), headline, summary, byline,
// published/updated dates, category + game markers, safe body, source
// attribution, and trust notes. No revision history, no author internals.

import type { PublicArticleDetail } from "@/features/news/domain/public-card";
import {
  EXTERNAL_SOURCE_HANDOFF_NOTE,
  ORIGINAL_REPORTING_NOTE,
  SOURCED_REPORTING_NOTE,
} from "@/features/news/domain/source";
import { NewsCategoryBadge, NewsMeta, SourceKindMarker, newsGameDisplayName } from "./news-bits";
import { ArticleBody } from "./article-body";

function formatInstant(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function NewsDetail({ card }: { card: PublicArticleDetail }) {
  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-lg bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase">
            <span className="text-accent-300">News</span>
            <span className="text-slate-300">· {newsGameDisplayName(card.game_key)}</span>
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            {card.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">{card.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <NewsCategoryBadge category={card.category} />
            <SourceKindMarker kind={card.source_kind} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Byline</dt>
            <dd className="mt-1 text-sm font-medium">{card.author_display_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Published</dt>
            <dd className="mt-1 text-sm font-medium">{formatInstant(card.published_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Updated</dt>
            <dd className="mt-1 text-sm font-medium">{formatInstant(card.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Reading time</dt>
            <dd className="mt-1 text-sm font-medium">{card.reading_minutes} min read</dd>
          </div>
        </dl>
        {card.tags.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">Tagged: {card.tags.join(", ")}</p>
        ) : null}
      </div>

      <NewsMeta
        gameKey={card.game_key}
        readingMinutes={card.reading_minutes}
        publishedAt={card.published_at}
      />

      <ArticleBody body={card.body} />

      <section aria-labelledby="news-source-heading" className="mt-8 max-w-2xl">
        <h2 id="news-source-heading" className="text-lg font-semibold">
          Source
        </h2>
        {card.source_kind === "original" ? (
          <p className="mt-2 text-sm text-slate-600">{ORIGINAL_REPORTING_NOTE}</p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-slate-600">{SOURCED_REPORTING_NOTE}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Source: {card.source_name ?? "Unnamed source"}
            </p>
            {card.source_url !== null ? (
              <div className="mt-2">
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Read the original announcement
                </a>
                <p className="mt-2 text-xs text-slate-500">{EXTERNAL_SOURCE_HANDOFF_NOTE}</p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="news-trust-heading" className="mt-6 max-w-2xl">
        <h2 id="news-trust-heading" className="text-lg font-semibold">
          Editorial note
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          News moderation and corrections arrive with a later decision — factual errors cannot be
          reported in-product yet, and no story here implies MicroNest endorsement of any team,
          organizer, or claim.
        </p>
      </section>
    </div>
  );
}
