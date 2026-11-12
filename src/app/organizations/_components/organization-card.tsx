// Public organization result card. Renders ONLY public directory fields.
// No logo imagery (no accepted media contract): an initial-letter mark is the
// complete avatar. Trust renders honestly: only `confirmed` shows a
// confirmation indicator; every other state shows a neutral label. Levels/
// recruitment are not members here — nothing invented.

import Link from "next/link";
import type { PublicOrganizationCard } from "@/features/organizations/domain/organization";
import { isConfirmedTrust, trustStateLabel } from "@/features/organizations/domain/trust";
import { orgTypeLabel } from "@/features/organizations/domain/org-type";
import { getGameByKey } from "@/lib/game-catalog/catalog";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.shortName ?? gameKey;
}

export function OrganizationAvatar({ name }: { name: string }) {
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

export function TrustBadge({ state }: { state: PublicOrganizationCard["trust_state"] }) {
  if (isConfirmedTrust(state)) {
    return (
      <li className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
        Confirmed
      </li>
    );
  }
  return (
    <li
      className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
      title={trustStateLabel(state)}
    >
      Unverified
    </li>
  );
}

export function OrganizationCard({ card }: { card: PublicOrganizationCard }) {
  const headingId = `org-${card.slug}-name`;
  return (
    <article aria-labelledby={headingId} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <OrganizationAvatar name={card.name} />
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="truncate text-base font-semibold">
          <Link
            href={`/organizations/${card.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {card.name} <span className="font-normal text-slate-500">@{card.slug}</span>
          </Link>
        </h3>
        <p className="mt-1 truncate text-sm text-slate-700">
          {orgTypeLabel(card.org_type)} · {card.region_code}
        </p>
        <p className="mt-1 truncate text-sm text-slate-500">
          {card.game_keys.length > 0 ? card.game_keys.map(gameDisplayName).join(" · ") : "Games to be announced"}
        </p>
        <ul aria-label="Organization details" className="mt-2 flex flex-wrap gap-1.5">
          <TrustBadge state={card.trust_state} />
          <li className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
            {card.team_count} {card.team_count === 1 ? "team" : "teams"}
          </li>
        </ul>
      </div>
    </article>
  );
}
