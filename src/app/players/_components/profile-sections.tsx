import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import { PlayerAvatar } from "./player-avatar";

function valueOrNotSpecified(value: string | null): string {
  return value === null || value.trim() === "" ? "Not specified" : value;
}

// Public profile body. Renders ONLY frozen projection fields; empty fields
// get an explicit placeholder — never invented data.
export function ProfileSections({ card }: { card: PublicPlayerCard }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="profile-heading" className="flex gap-5">
        <PlayerAvatar src={card.avatar_url} name={card.display_name} size={128} />
        <div className="min-w-0">
          <h1
            id="profile-heading"
            className="text-2xl font-bold tracking-tight break-words sm:text-3xl"
          >
            {card.display_name}
          </h1>
          <p className="mt-1 text-base text-slate-500">@{card.handle}</p>
          {card.country_code !== null ? (
            <p className="mt-2 text-sm text-slate-700">Country: {card.country_code}</p>
          ) : null}
        </div>
      </section>

      {card.bio !== null && card.bio.trim() !== "" ? (
        <section aria-labelledby="profile-bio-heading">
          <h2 id="profile-bio-heading" className="text-lg font-semibold">
            About
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 break-words text-slate-700">{card.bio}</p>
        </section>
      ) : null}

      <section aria-labelledby="profile-game-heading">
        <h2 id="profile-game-heading" className="text-lg font-semibold">
          {card.game_name}
        </h2>
        <dl className="mt-3 grid max-w-2xl gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              In-game name
            </dt>
            <dd className="mt-1 text-sm font-medium break-words">{card.ign}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Primary role
            </dt>
            <dd className="mt-1 text-sm">{valueOrNotSpecified(card.primary_role)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Region</dt>
            <dd className="mt-1 text-sm">{valueOrNotSpecified(card.region_code)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Availability
            </dt>
            <dd className="mt-1 text-sm">
              {card.availability.length > 0 ? card.availability.join(", ") : "Not specified"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Modes</dt>
            <dd className="mt-1 text-sm">
              {card.play_modes.length > 0 ? card.play_modes.join(", ") : "Not specified"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
