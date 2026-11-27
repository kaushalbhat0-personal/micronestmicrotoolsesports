// Public organization detail presentation. Renders ONLY public detail fields.
// Trust renders honestly (confirmed vs unverified). Teams render as a derived
// count with an explicit independence note — no member identities, no silent
// attachment. Recruitment renders as an explicit unavailable note (no grounded
// data in this phase). External links render only when https-valid.

import Link from "next/link";
import type { PublicOrganizationDetail } from "@/features/organizations/domain/organization";
import { isConfirmedTrust, trustStateLabel, trustStateNote } from "@/features/organizations/domain/trust";
import { orgTypeLabel } from "@/features/organizations/domain/org-type";
import { EXTERNAL_LINK_HANDOFF_NOTE } from "@/features/organizations/domain/links";
import { getGameByKey } from "@/lib/game-catalog/catalog";
import { OrganizationAvatar } from "./organization-card";

function gameDisplayName(gameKey: string): string {
  return getGameByKey(gameKey)?.name ?? gameKey;
}

export function OrganizationProfileSections({ card }: { card: PublicOrganizationDetail }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-4">
        <OrganizationAvatar name={card.name} />
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
        {trustStateLabel(card.trust_state)}. {trustStateNote(card.trust_state)}
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Type</dt>
          <dd className="mt-1 text-sm font-medium">{orgTypeLabel(card.org_type)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Region</dt>
          <dd className="mt-1 text-sm font-medium">{card.region_code}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Games</dt>
          <dd className="mt-1 text-sm font-medium">
            {card.game_keys.length > 0 ? card.game_keys.map(gameDisplayName).join(" · ") : "To be announced"}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="org-about-heading" className="mt-6">
        <h2 id="org-about-heading" className="text-lg font-semibold">
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

      <section aria-labelledby="org-teams-heading" className="mt-6">
        <h2 id="org-teams-heading" className="text-lg font-semibold">
          Teams
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {card.team_count} public {card.team_count === 1 ? "team" : "teams"} associated.
        </p>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Teams stay independently discoverable at{" "}
          <Link href="/teams" className="underline underline-offset-2">
            /teams
          </Link>{" "}
          whether or not they are associated with an organization. Public team identities for this
          organization are unavailable in this phase.
        </p>
      </section>

      <section aria-labelledby="org-recruitment-heading" className="mt-6">
        <h2 id="org-recruitment-heading" className="text-lg font-semibold">
          Recruitment
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Public recruitment opportunities are unavailable in this phase — nothing is listed here,
          and no availability is claimed.
        </p>
      </section>

      <section aria-labelledby="org-links-heading" className="mt-6">
        <h2 id="org-links-heading" className="text-lg font-semibold">
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
