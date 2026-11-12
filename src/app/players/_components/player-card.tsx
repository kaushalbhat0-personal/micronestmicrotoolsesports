import Link from "next/link";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import { PlayerAvatar } from "./player-avatar";

// Public result card. Renders ONLY frozen projection fields (handle,
// display_name, avatar_url, bio country/game/role/mode/region/availability).
// No IDs, no contact surface, no metrics, no verification claims.
export function PlayerCard({ card }: { card: PublicPlayerCard }) {
  const headingId = `player-${card.handle}-name`;
  const chips: string[] = [card.game_name];
  if (card.primary_role !== null) {
    chips.push(card.primary_role);
  }
  if (card.region_code !== null) {
    chips.push(card.region_code);
  }
  if (card.country_code !== null) {
    chips.push(card.country_code);
  }
  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col border border-slate-deep/20 bg-paper"
    >
      <div className="border-b-2 border-accent-600 bg-arena-950 px-4 py-2">
        <p className="truncate text-[11px] font-bold tracking-[0.16em] text-slate-200 uppercase">
          {card.game_name}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 gap-4 p-4 sm:p-5">
        <PlayerAvatar src={card.avatar_url} name={card.display_name} size={56} />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="font-display truncate text-lg font-extrabold tracking-tight uppercase">
            <Link
              href={`/players/${card.handle}`}
              className="rounded-none underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              {card.display_name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate font-mono text-sm text-ink-600">
            @{card.handle} · {card.ign}
          </p>
          <ul aria-label="Game details" className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip}
                className="inline-flex min-h-[24px] items-center border border-slate-deep/25 bg-steel-100 px-2 py-0.5 text-xs font-semibold text-steel-ink"
              >
                {chip}
              </li>
            ))}
            {card.play_modes.length > 0 ? (
              <li className="inline-flex min-h-[24px] items-center border border-slate-deep/25 px-2 py-0.5 text-xs text-ink-600">
                {card.play_modes.join(" · ")}
              </li>
            ) : null}
            {card.availability.map((window) => (
              <li
                key={window}
                className="inline-flex min-h-[24px] items-center border border-accent-600 px-2 py-0.5 text-xs font-semibold text-accent-600"
              >
                {window}
              </li>
            ))}
          </ul>
          {card.bio !== null && card.bio.trim() !== "" ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">
              {card.bio}
            </p>
          ) : null}
          <Link
            href={`/players/${card.handle}`}
            aria-label={`View profile of ${card.display_name} (@${card.handle})`}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            View profile
            <span aria-hidden="true" className="ml-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
