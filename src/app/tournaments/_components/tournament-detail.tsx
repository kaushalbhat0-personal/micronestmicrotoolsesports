// Public tournament detail presentation. Renders ONLY public detail
// fields: banner treatment (CSS-only arena panel — no stock imagery, no
// fabricated media), title, game, region, format, dates in the event
// timezone, entry fee + prize pool ("Not disclosed" when absent — never
// invented), eligibility, participation requirements, registration handoff,
// organizer, and trust notes.
//
// External vs internal registration is explicit: every handoff states that
// registration happens on the organizer's site and that MicroNest collects
// nothing. Operations, payment, and results flows are out of scope and do
// not appear here.

import type { PublicTournamentDetail } from "@/features/tournaments/domain/public-card";
import { MAX_DATETIME_DRIFT_NOTE, formatInTimezone } from "@/features/tournaments/domain/dates";
import { formatEntryFee, formatPrizePool } from "@/features/tournaments/domain/money";
import { ORGANIZER_TRUST_NOTE } from "@/features/tournaments/domain/organizer";
import { EXTERNAL_HANDOFF_NOTE } from "@/features/tournaments/domain/registration";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import { OrganizerCard } from "./organizer-card";
import { TournamentStatusBadge } from "./tournament-bits";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.name ?? gameKey;
}

function formatLabel(format: string): string {
  if (format === "team") return "Teams";
  if (format === "individual") return "Individual players";
  return "Teams and individual players";
}

export function TournamentDetail({ card }: { card: PublicTournamentDetail }) {
  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-lg bg-arena-950 text-white">
        <div className="border-b-2 border-accent-600 px-4 py-8 sm:px-6">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase">
            <span className="text-accent-300">{gameDisplayName(card.game_key)}</span>
            <TournamentStatusBadge status={card.status} />
          </p>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
            {card.title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {card.region_code} · {formatLabel(card.format)}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Starts</dt>
          <dd className="mt-1 text-sm font-medium">
            {formatInTimezone(card.starts_at, card.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Ends</dt>
          <dd className="mt-1 text-sm font-medium">{formatInTimezone(card.ends_at, card.timezone)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Entry fee</dt>
          <dd className="mt-1 text-sm font-medium">{formatEntryFee(card.entry_fee)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Prize pool</dt>
          <dd className="mt-1 text-sm font-medium">{formatPrizePool(card.prize_pool)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        Times in {card.timezone}. {MAX_DATETIME_DRIFT_NOTE}
      </p>

      {card.description !== null && card.description.trim() !== "" ? (
        <section aria-labelledby="tournament-about-heading" className="mt-6">
          <h2 id="tournament-about-heading" className="text-lg font-semibold">
            About
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {card.description}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="tournament-eligibility-heading" className="mt-6">
        <h2 id="tournament-eligibility-heading" className="text-lg font-semibold">
          Eligibility & participation
        </h2>
        {card.eligibility === null ? (
          <p className="mt-2 text-sm text-slate-500">
            No eligibility requirements published. Confirm details with the organizer before
            registering.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Format: {formatLabel(card.format)}.</li>
            {card.eligibility.min_team_size !== null || card.eligibility.max_team_size !== null ? (
              <li>
                Squad size: {card.eligibility.min_team_size ?? "…"}–
                {card.eligibility.max_team_size ?? "…"} players.
              </li>
            ) : null}
            {card.eligibility.region_codes.length > 0 ? (
              <li>Regions: {card.eligibility.region_codes.join(", ")}.</li>
            ) : null}
            {card.eligibility.min_age !== null ? (
              <li>Minimum age: {card.eligibility.min_age}.</li>
            ) : null}
            {card.eligibility.note !== null && card.eligibility.note.trim() !== "" ? (
              <li>{card.eligibility.note}</li>
            ) : null}
          </ul>
        )}
      </section>

      <section aria-labelledby="tournament-register-heading" className="mt-6">
        <h2 id="tournament-register-heading" className="text-lg font-semibold">
          Registration
        </h2>
        {card.registration_url !== null ? (
          <div className="mt-2">
            <a
              href={card.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Register on the organizer&apos;s site
            </a>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{EXTERNAL_HANDOFF_NOTE}</p>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-slate-700">
              {card.contact_instructions !== null && card.contact_instructions.trim() !== ""
                ? card.contact_instructions
                : "Registration details are not published yet. Check back or contact the organizer."}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Registration happens outside MicroNest — we never collect entry fees or payments.
            </p>
          </div>
        )}
      </section>

      <div className="mt-6">
        <OrganizerCard organizer={card.organizer} />
      </div>

      <section aria-labelledby="tournament-trust-heading" className="mt-6">
        <h2 id="tournament-trust-heading" className="text-lg font-semibold">
          Trust & reporting
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{ORGANIZER_TRUST_NOTE}</p>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Tournament moderation and reporting arrive with a later decision — suspicious listings
          cannot be reported in-product yet, and no listing here implies MicroNest endorsement.
        </p>
      </section>
    </div>
  );
}
