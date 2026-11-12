// Public team detail presentation. Renders ONLY public detail fields
// (slug, name, game, region, description, levels, recruiting, member count).
// Roster identities are member-private under D1 RLS: this surface shows the
// public member count plus an explicit unavailability note — it never
// invents member rows. Levels carry the self-reported note (D1-D6 pending).

import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import { SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import { TeamAvatar } from "./team-card";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.name ?? gameKey;
}

export function TeamProfileSections({ card }: { card: PublicTeamDetail }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-4">
        <TeamAvatar name={card.name} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{card.name}</h1>
          <p className="mt-1 text-sm text-slate-600">@{card.slug}</p>
          <p className="mt-2">
            <span
              className={
                card.recruiting
                  ? "inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
                  : "inline-block rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
              }
            >
              {card.recruiting ? "Recruiting" : "Not recruiting"}
            </span>
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Game</dt>
          <dd className="mt-1 text-sm font-medium">{gameDisplayName(card.game_key)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Region</dt>
          <dd className="mt-1 text-sm font-medium">{card.region_code}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Current level</dt>
          <dd className="mt-1 text-sm font-medium" title={SELF_REPORTED_LEVEL_NOTE}>
            {card.current_level} <span className="font-normal text-slate-500">(self-reported)</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Target level</dt>
          <dd className="mt-1 text-sm font-medium" title={SELF_REPORTED_LEVEL_NOTE}>
            {card.target_level} <span className="font-normal text-slate-500">(self-reported)</span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">{SELF_REPORTED_LEVEL_NOTE}</p>

      <section aria-labelledby="team-about-heading" className="mt-6">
        <h2 id="team-about-heading" className="text-lg font-semibold">
          About
        </h2>
        {card.description !== null && card.description.trim() !== "" ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {card.description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No description provided.</p>
        )}
      </section>

      <section aria-labelledby="team-roster-heading" className="mt-6">
        <h2 id="team-roster-heading" className="text-lg font-semibold">
          Roster
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {card.member_count} {card.member_count === 1 ? "member" : "members"}
        </p>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Public roster identities are unavailable in this phase — member details are visible only
          to team members.
        </p>
      </section>
    </div>
  );
}
