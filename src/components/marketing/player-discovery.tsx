// M2 player-discovery proof band: the shipped directory, described exactly
// as implemented (G1-6). Links to /players. Static only — no data fetching,
// no projection imports, no invented listings.

import Link from "next/link";
import { MarketingCTA } from "./cta-button";
import { MarketingSection } from "./section";

const liveCapabilities: Array<string> = [
  "Filterable directory — game, region, role, name",
  "Public profile pages with shareable handle URLs",
  "Discoverability consent and per-game visibility controls",
  "Handle ownership with a cooldown on changes",
  "Full profile deletion that preserves login integrity",
];

const listingFields: Array<{ field: string; note: string }> = [
  { field: "Handle + display name", note: "Player-chosen identity" },
  { field: "In-game name (IGN)", note: "Per-game profile" },
  { field: "Game, role, region", note: "Searchable facets" },
  { field: "Availability windows", note: "When they can play" },
];

export function PlayerDiscovery() {
  return (
    <MarketingSection
      id="player-discovery"
      tone="steel"
      eyebrow="Available now"
      title="Player discovery is live"
      lede="The public player directory and profile pages are shipped and working. Everything below maps to implemented functionality — open the directory and verify it yourself."
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <ul className="divide-y divide-ink-900/10 border-y border-ink-900/10">
            {liveCapabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3 py-3 text-sm font-medium sm:text-base">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 bg-accent-600" />
                {capability}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <MarketingCTA href="/players" variant="dark">
              Open the player directory
            </MarketingCTA>
          </div>
        </div>

        <div className="min-w-0 rounded-sm border border-steel-200 bg-paper p-6 sm:p-8">
          <h3 className="text-xs font-bold tracking-[0.18em] text-ink-600 uppercase">
            What every listing shows — and nothing more
          </h3>
          <dl className="mt-4 divide-y divide-ink-900/10 border-y border-ink-900/10">
            {listingFields.map((row) => (
              <div key={row.field} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <dt className="text-sm font-bold">{row.field}</dt>
                <dd className="text-sm text-ink-600">{row.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Listings render only public projection fields. No contact details,
            no private identifiers, no rankings or verification claims. See the{" "}
            <Link
              href="/about"
              className="rounded font-semibold text-accent-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              availability statement
            </Link>{" "}
            for what is and is not shipped.
          </p>
        </div>
      </div>
    </MarketingSection>
  );
}
