// Public team result card. Renders ONLY public directory fields (slug, name,
// game, region, levels, recruiting, member count). Levels are always labelled
// self-reported (D1-D6 pending — never a MicroNest rating). No IDs beyond the
// public slug link, no owner/org internals, no applicant data, no metrics.

import Link from "next/link";
import type { PublicTeamCard } from "@/features/teams/domain/team-directory";
import { SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";
import { getGameByKey } from "@/lib/game-catalog/catalog";

function gameDisplayName(gameKey: string): string {
  // Display-only resolution: unknown keys render raw (never rejected here —
  // the reader fails unknown filter values closed to zero rows instead).
  return getGameByKey(gameKey)?.shortName ?? gameKey;
}

export function TeamAvatar({ name }: { name: string }) {
  // P1 has no team logo column (D1 schema) and invents no imagery: an
  // initial-letter mark is the complete avatar.
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-2xl font-bold text-white"
    >
      {initial}
    </span>
  );
}

export function TeamCard({ card }: { card: PublicTeamCard }) {
  const headingId = `team-${card.slug}-name`;
  return (
    <article aria-labelledby={headingId} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <TeamAvatar name={card.name} />
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="truncate text-base font-semibold">
          <Link
            href={`/teams/${card.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {card.name} <span className="font-normal text-slate-500">@{card.slug}</span>
          </Link>
        </h3>
        <p className="mt-1 truncate text-sm text-slate-700">
          {gameDisplayName(card.game_key)} · {card.region_code}
        </p>
        <ul aria-label="Team details" className="mt-2 flex flex-wrap gap-1.5">
          <li
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            title={SELF_REPORTED_LEVEL_NOTE}
          >
            {card.current_level} (self-reported)
          </li>
          <li
            className={
              card.recruiting
                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
                : "rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
            }
          >
            {card.recruiting ? "Recruiting" : "Not recruiting"}
          </li>
          <li className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
            {card.member_count} {card.member_count === 1 ? "member" : "members"}
          </li>
        </ul>
      </div>
    </article>
  );
}
