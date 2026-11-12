// Public brand detail presentation. Renders ONLY public detail fields.
// Trust renders honestly (confirmed vs unverified). Interests are declared
// intent — the page never claims the brand is looking for partners and never
// claims the viewer represents the brand. Sponsorship opportunities render as
// an explicit unavailable note. No contact or inquiry handoff exists in P8.

import type { PublicBrandDetail } from "@/features/brands/domain/brand";
import {
  isConfirmedTrust,
  trustStateLabel,
  trustStateNote,
} from "@/features/organizations/domain/trust";
import { EXTERNAL_LINK_HANDOFF_NOTE } from "@/features/organizations/domain/links";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import { BrandAvatar } from "./brand-card";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.name ?? gameKey;
}

export function BrandProfileSections({ card }: { card: PublicBrandDetail }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-4">
        <BrandAvatar name={card.name} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{card.name}</h1>
          <p className="mt-1 text-sm text-slate-600">@{card.slug}</p>
          <p className="mt-2">
            {isConfirmedTrust(card.trust_state) ? (
              <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                Confirmed
              </span>
            ) : (
              <span
                className="inline-block rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
                title={trustStateLabel(card.trust_state)}
              >
                Unverified
              </span>
            )}
          </p>
        </div>
      </div>

      <p role="note" className="mt-3 max-w-2xl text-sm text-slate-600">
        {trustStateLabel(card.trust_state)}. {trustStateNote(card.trust_state)} This profile does
        not prove that any viewer represents this brand.
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Industry</dt>
          <dd className="mt-1 text-sm font-medium">{card.industry}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Region</dt>
          <dd className="mt-1 text-sm font-medium">{card.region_code}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Games of interest
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {card.game_interests.length > 0
              ? card.game_interests.map(gameDisplayName).join(" · ")
              : "To be announced"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Partnership types
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {card.partnership_types.length > 0 ? card.partnership_types.join(" · ") : "To be announced"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Sponsorship interests
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {card.sponsorship_interests.join(" · ")}
          </dd>
          <p className="mt-1 text-xs font-normal text-slate-500">
            Declared interest only — not a confirmed offer or availability.
          </p>
        </div>
      </dl>

      <section aria-labelledby="brand-about-heading" className="mt-6">
        <h2 id="brand-about-heading" className="text-lg font-semibold">
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

      <section aria-labelledby="brand-opportunities-heading" className="mt-6">
        <h2 id="brand-opportunities-heading" className="text-lg font-semibold">
          Sponsorship opportunities
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Public sponsorship opportunities are unavailable in this phase — nothing is listed here,
          and no availability is claimed.
        </p>
      </section>

      <section aria-labelledby="brand-rep-heading" className="mt-6">
        <h2 id="brand-rep-heading" className="text-lg font-semibold">
          Representation
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Representative status is unverified in this phase. No contact or inquiry handoff is
          offered until the verification and evidence-handling rules are approved.
        </p>
      </section>

      <section aria-labelledby="brand-links-heading" className="mt-6">
        <h2 id="brand-links-heading" className="text-lg font-semibold">
          Links
        </h2>
        {card.website_url === null && card.social_links.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No public links provided.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {card.website_url !== null ? (
              <li>
                <a
                  href={card.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-slate-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Website
                </a>
              </li>
            ) : null}
            {card.social_links.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-slate-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">{EXTERNAL_LINK_HANDOFF_NOTE}</p>
      </section>
    </div>
  );
}
