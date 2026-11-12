// Public organizer profile detail. Renders ONLY public detail fields:
// identity, description, games, region, links, trust state, published
// tournament count, explicit organization linkage (when approved). No owner
// identity, no membership, no verification evidence, no timestamps.

import Link from "next/link";
import type { PublicOrganizerDetail } from "@/features/organizers/domain/organizer";
import { ORGANIZER_LINKS_NOTE } from "@/features/organizers/domain/links";
import { organizerTypeLabel } from "@/features/organizers/domain/organizer-type";
import {
  isConfirmedOrganizerTrust,
  organizerTrustLabel,
  organizerTrustNote,
} from "@/features/organizers/domain/trust";

export function OrganizerDetail({ card }: { card: PublicOrganizerDetail }) {
  const confirmed = isConfirmedOrganizerTrust(card.trust_state);
  const initial = card.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="min-w-0">
      <div className="bg-arena-950 overflow-hidden rounded-lg text-white">
        <div className="border-accent-600 border-b-2 px-4 py-8 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-accent-300 text-xs font-bold tracking-[0.18em] uppercase">
                {organizerTypeLabel(card.organizer_type)}
              </p>
              <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
                {card.name}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {card.region_code} ·{" "}
            {card.game_keys.length > 0 ? card.game_keys.join(" · ") : "No games listed"}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Trust status</h2>
        <p className="mt-2 text-sm font-medium">
          {confirmed ? (
            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
              Confirmed
            </span>
          ) : (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Unverified · {organizerTrustLabel(card.trust_state)}
            </span>
          )}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {organizerTrustNote(card.trust_state)}
        </p>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Publishing a tournament does not confirm an organizer, and a confirmed organizer is never
          implied from a listing. Only MicroNest review confirms an organizer.
        </p>
      </div>

      {card.description !== null && card.description.trim() !== "" ? (
        <section aria-labelledby="organizer-about-heading" className="mt-6">
          <h2 id="organizer-about-heading" className="text-lg font-semibold">
            About
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {card.description}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="organizer-links-heading" className="mt-6">
        <h2 id="organizer-links-heading" className="text-lg font-semibold">
          Links
        </h2>
        {card.website_url === null && card.social_links.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No public links published by this organizer yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {card.website_url !== null ? (
              <li>
                <a
                  href={card.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Website
                </a>
              </li>
            ) : null}
            {card.social_links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 max-w-2xl text-xs text-slate-500">{ORGANIZER_LINKS_NOTE}</p>
      </section>

      {card.organization_slug !== null ? (
        <section aria-labelledby="organizer-org-heading" className="mt-6">
          <h2 id="organizer-org-heading" className="text-lg font-semibold">
            Linked organization
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Explicitly linked to{" "}
            <Link
              href={`/organizations/${card.organization_slug}`}
              className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {card.organization_slug}
            </Link>
            . Organization membership never implies organizer permissions.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="organizer-tournaments-heading" className="mt-6">
        <h2 id="organizer-tournaments-heading" className="text-lg font-semibold">
          Published tournaments
        </h2>
        {card.published_tournament_count === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No published tournaments yet. Tournament listings appear here once this organizer
            publishes through MicroNest review.
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-slate-600">
              {card.published_tournament_count} published{" "}
              {card.published_tournament_count === 1 ? "tournament" : "tournaments"}.
            </p>
            <Link
              href={`/tournaments?query=${encodeURIComponent(card.name)}`}
              className="mt-2 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              View in tournament directory
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
