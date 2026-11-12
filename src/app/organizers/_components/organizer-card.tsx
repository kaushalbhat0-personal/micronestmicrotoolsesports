// Public organizer result card. Renders ONLY public directory fields:
// name/slug link, region, type, games, trust state, published tournament
// count (or "No published tournaments yet" — never invented). No IDs, no
// contact surface, no verification evidence.

import Link from "next/link";
import type { PublicOrganizerCard } from "@/features/organizers/domain/organizer";
import { organizerTypeLabel } from "@/features/organizers/domain/organizer-type";
import { isConfirmedOrganizerTrust, organizerTrustLabel } from "@/features/organizers/domain/trust";

function InitialMark({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white"
    >
      {letter}
    </span>
  );
}

export function OrganizerCard({ card }: { card: PublicOrganizerCard }) {
  const confirmed = isConfirmedOrganizerTrust(card.trust_state);
  return (
    <article
      aria-labelledby={`organizer-${card.slug}-name`}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <InitialMark name={card.name} />
        <div className="min-w-0">
          <h3 id={`organizer-${card.slug}-name`} className="min-w-0 text-base font-semibold">
            <Link
              href={`/organizers/${card.slug}`}
              className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {card.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {card.region_code} · {organizerTypeLabel(card.organizer_type)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {card.game_keys.length > 0 ? card.game_keys.join(" · ") : "No games listed"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            confirmed ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"
          }`}
        >
          {confirmed ? "Confirmed" : `Unverified · ${organizerTrustLabel(card.trust_state)}`}
        </span>
        <span className="text-xs text-slate-500">
          {card.published_tournament_count === 0
            ? "No published tournaments yet"
            : `${card.published_tournament_count} published ${
                card.published_tournament_count === 1 ? "tournament" : "tournaments"
              }`}
        </span>
      </div>
    </article>
  );
}
