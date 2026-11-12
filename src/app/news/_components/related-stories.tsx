import Link from "next/link";
import type { PublicArticleCard } from "@/features/news/domain/public-card";
import { articleCategoryLabel } from "@/features/news/domain/article";
import { NewsCard } from "./news-card";

// Related stories: same game first, then same category, capped at three.
// Never includes the current slug. Pure presentation over the page slice:
// no extra queries, no existence signal beyond the visible list.
export function RelatedStories({
  current,
  candidates,
}: {
  current: PublicArticleCard;
  candidates: PublicArticleCard[];
}) {
  const related = candidates
    .filter((card) => card.slug !== current.slug)
    .sort((a, b) => {
      const aGame = a.game_key !== null && a.game_key === current.game_key ? 0 : 1;
      const bGame = b.game_key !== null && b.game_key === current.game_key ? 0 : 1;
      if (aGame !== bGame) {
        return aGame - bGame;
      }
      const aCat = a.category === current.category ? 0 : 1;
      const bCat = b.category === current.category ? 0 : 1;
      return aCat - bCat;
    })
    .slice(0, 3);
  if (related.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="news-related-heading" className="mt-10">
      <h2 id="news-related-heading" className="font-display text-lg font-extrabold tracking-tight uppercase">
        Related stories
      </h2>
      <ul className="mt-3 grid gap-4 md:grid-cols-3">
        {related.map((card) => (
          <li key={card.slug}>
            <article className="h-full rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase">
                {articleCategoryLabel(card.category)}
              </p>
              <h3 className="mt-1 text-sm font-semibold">
                <Link
                  href={`/news/${card.slug}`}
                  className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {card.headline}
                </Link>
              </h3>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { NewsCard };
