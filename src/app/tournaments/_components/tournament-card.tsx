// Public tournament result card. Renders ONLY public directory fields:
// title/slug link, game, region, format, dates in the event timezone,
// entry fee + prize pool (or "Not disclosed" — never invented), organizer
// name, status badge, and the registration availability indicator. No IDs,
// no contact surface, no metrics, no verification badges.

import Link from "next/link";
import type { PublicTournamentCard } from "@/features/tournaments/domain/public-card";
import { organizerKindLabel } from "@/features/tournaments/domain/organizer";
import {
  RegistrationIndicator,
  TournamentDates,
  TournamentMoney,
  TournamentStatusBadge,
  gameDisplayName,
} from "./tournament-bits";

export function TournamentCard({ card }: { card: PublicTournamentCard }) {
  const headingId = `tournament-${card.slug}-name`;
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="min-w-0 text-base font-semibold">
          <Link
            href={`/tournaments/${card.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {card.title}
          </Link>
        </h3>
        <TournamentStatusBadge status={card.status} />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {gameDisplayName(card.game_key)} · {card.region_code} · {card.format}
      </p>
      <TournamentDates card={card} />
      <TournamentMoney card={card} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RegistrationIndicator card={card} nowMs={Date.now()} />
        <span className="text-xs text-slate-500">
          by {card.organizer.name} ({organizerKindLabel(card.organizer.kind)})
        </span>
      </div>
    </article>
  );
}
