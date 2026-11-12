// Homepage hero: carbon arena band with illustrative player dossier.
// Stitch-approved composition. The visual is an explicitly labelled
// illustrative projection format — never a real athlete, never scraped data,
// no verification or skill claims. Static only: CTAs link to real routes.

import Link from "next/link";
import { MarketingCTA } from "./cta-button";

const dossierRows: Array<{ field: string; value: string }> = [
  { field: "Handle", value: "@demo_player" },
  { field: "IGN", value: "SAMPLE_IGN" },
  { field: "Game", value: "BGMI" },
  { field: "Role · Region", value: "In-Game Leader · India (North)" },
  { field: "Modes", value: "Squad (TPP)" },
  { field: "Status", value: "Open to tryouts (demo)" },
];

const trustMarkers: Array<string> = [
  "Direct recruitment",
  "Community opt-in directory",
  "Circuits & cups",
  "Organizer self-declared listings",
  "Zero-telemetry local utilities",
];

export function ArenaHero() {
  return (
    <div className="w-full bg-arena-950 text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">
            <span aria-hidden="true" className="inline-block h-3 w-1 bg-accent-600" />
            Community directory &amp; esports utility ecosystem — BGMI first
          </p>
          <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,4rem)] leading-[0.95] font-extrabold tracking-tight uppercase">
            Where esports talent gets discovered
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Discover opt-in player projections, self-declared team rosters,
            regional organizations, and community tournament listings. Only
            players who choose to be discoverable appear — nothing is scraped,
            nothing is verified.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MarketingCTA href="/players">Explore players</MarketingCTA>
            <MarketingCTA href="/tournaments" variant="ghost-on-dark">
              Discover tournaments
            </MarketingCTA>
          </div>
          <ul aria-label="Platform guarantees" className="mt-8 flex flex-wrap gap-2">
            {trustMarkers.map((marker) => (
              <li
                key={marker}
                className="inline-flex min-h-[28px] items-center border border-white/15 bg-arena-900 px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-slate-300 uppercase"
              >
                {marker}
              </li>
            ))}
          </ul>
        </div>

        <figure className="min-w-0 border border-white/15 bg-arena-900">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
            <figcaption className="text-xs font-bold tracking-[0.18em] text-slate-200 uppercase">
              Illustrative demo profile — not a real athlete
            </figcaption>
            <span className="inline-flex items-center gap-1.5 bg-arena-950 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-slate-200 uppercase">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-accent-600" />
              Specimen
            </span>
          </div>
          <dl className="divide-y divide-white/10 px-5 py-2">
            {dossierRows.map((row) => (
              <div key={row.field} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                  {row.field}
                </dt>
                <dd className="min-w-0 truncate font-mono text-sm text-slate-100">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-white/10 px-5 py-4">
            <p className="text-xs leading-relaxed text-slate-400">
              Illustrative athlete profile demonstrating self-attested
              projection fields. No actual athlete data, competitive records,
              or verification implied.
            </p>
            <Link
              href="/players"
              className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-accent-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore player directory
              <span aria-hidden="true" className="ml-1">
                →
              </span>
            </Link>
          </div>
        </figure>
      </div>
    </div>
  );
}
