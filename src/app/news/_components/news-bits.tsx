// Public news presentation bits. Editorial styling (magazine hierarchy),
// not dashboard styling: category kicker, game marker, reading time, and
// the source-kind marker. No verification badges, no metrics.

import { articleCategoryLabel, type ArticleCategory } from "@/features/news/domain/article";
import { getGameByKey } from "@/lib/game-catalog/catalog";

const categoryStyles: Record<string, string> = {
  industry: "bg-slate-900 text-white",
  "game-update": "bg-emerald-100 text-emerald-900",
  tournament: "bg-amber-100 text-amber-900",
  team: "bg-sky-100 text-sky-900",
  player: "bg-violet-100 text-violet-900",
  platform: "bg-slate-100 text-slate-700",
  guide: "bg-rose-100 text-rose-900",
};

export function NewsCategoryBadge({ category }: { category: ArticleCategory }) {
  const style = categoryStyles[category] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${style}`}
    >
      {articleCategoryLabel(category)}
    </span>
  );
}

export function newsGameDisplayName(gameKey: string | null): string {
  if (gameKey === null) {
    return "MicroNest";
  }
  return getGameByKey(gameKey)?.shortName ?? gameKey;
}

export function NewsMeta({
  gameKey,
  readingMinutes,
  publishedAt,
}: {
  gameKey: string | null;
  readingMinutes: number;
  publishedAt: string;
}) {
  let date = publishedAt;
  try {
    date = new Date(publishedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    date = publishedAt;
  }
  return (
    <p className="mt-1 text-xs text-slate-500">
      {newsGameDisplayName(gameKey)} · {readingMinutes} min read · {date}
    </p>
  );
}

export function SourceKindMarker({ kind }: { kind: "original" | "sourced" }) {
  return (
    <span className="inline-block rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-slate-600 uppercase">
      {kind === "original" ? "Original" : "Sourced"}
    </span>
  );
}
