// Public brand result card. Renders ONLY public directory fields.
// Industry + interests are declared intent, never confirmed supply. Trust
// renders honestly: only `confirmed` shows a confirmation indicator.
// Representative verification is frozen false everywhere and never rendered
// as a badge.

import Link from "next/link";
import type { PublicBrandCard } from "@/features/brands/domain/brand";
import { isConfirmedTrust } from "@/features/organizations/domain/trust";
import { getGameByKey } from "@/lib/game-catalog/catalog";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.shortName ?? gameKey;
}

export function BrandAvatar({ name }: { name: string }) {
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

export function BrandCard({ card }: { card: PublicBrandCard }) {
  const headingId = `brand-${card.slug}-name`;
  return (
    <article aria-labelledby={headingId} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <BrandAvatar name={card.name} />
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="truncate text-base font-semibold">
          <Link
            href={`/brands/${card.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {card.name} <span className="font-normal text-slate-500">@{card.slug}</span>
          </Link>
        </h3>
        <p className="mt-1 truncate text-sm text-slate-700">
          {card.industry} · {card.region_code}
        </p>
        <p className="mt-1 truncate text-sm text-slate-500">
          {card.game_interests.length > 0
            ? card.game_interests.map(gameDisplayName).join(" · ")
            : "Game interests to be announced"}
        </p>
        <ul aria-label="Brand details" className="mt-2 flex flex-wrap gap-1.5">
          {isConfirmedTrust(card.trust_state) ? (
            <li className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
              Confirmed
            </li>
          ) : (
            <li className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
              Unverified
            </li>
          )}
          {card.sponsorship_interests.map((interest) => (
            <li
              key={interest}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {interest}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
