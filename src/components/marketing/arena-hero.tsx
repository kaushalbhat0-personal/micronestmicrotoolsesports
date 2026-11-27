// Homepage hero: carbon arena band with illustrative player dossier.
// FRAGIX brand-first composition. The visual is an explicitly labelled
// illustrative projection format — never a real athlete, never scraped data.
// Static only: CTAs link to real routes.

import Link from "next/link";
import { siteConfig } from "@/config/site";
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
  "Share identity immediately",
  "Ownership review for registry",
  "Community opt-in directory",
  "Circuits & cups",
  "Zero-telemetry local utilities",
];

export function ArenaHero() {
  return (
    <div className="bg-arena-950 w-full text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        <div className="min-w-0">
          <p className="text-accent-300 flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="bg-accent-600 inline-block h-3 w-1" />
            {siteConfig.category} — BGMI first
          </p>
          <h1 className="font-display mt-5 text-[clamp(2.75rem,8vw,4.5rem)] leading-[0.92] font-extrabold tracking-tight uppercase">
            {siteConfig.name}
          </h1>
          <p className="font-display mt-3 text-[clamp(1.25rem,3vw,1.75rem)] font-bold tracking-tight text-slate-100 uppercase">
            {siteConfig.tagline}
          </p>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Create your competitive identity, share your card and profile URL immediately, then get
            BGMI ownership reviewed to appear in the public player registry. Opt-in only — nothing
            is scraped.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MarketingCTA href="/signup">Sign up free</MarketingCTA>
            <MarketingCTA href="/tournaments" variant="ghost-on-dark">
              Discover tournaments
            </MarketingCTA>
          </div>
          <ul aria-label="Platform guarantees" className="mt-8 flex flex-wrap gap-2">
            {trustMarkers.map((marker) => (
              <li
                key={marker}
                className="bg-arena-900 inline-flex min-h-[28px] items-center border border-white/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-slate-300 uppercase"
              >
                {marker}
              </li>
            ))}
          </ul>
        </div>

        <figure className="bg-arena-900 min-w-0 border border-white/15">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
            <figcaption className="text-xs font-bold tracking-[0.18em] text-slate-200 uppercase">
              Illustrative demo profile — not a real athlete
            </figcaption>
            <span className="bg-arena-950 inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-slate-200 uppercase">
              <span
                aria-hidden="true"
                className="bg-accent-600 inline-block h-1.5 w-1.5 rounded-full"
              />
              Specimen
            </span>
          </div>
          <dl className="divide-y divide-white/10 px-5 py-2">
            {dossierRows.map((row) => (
              <div key={row.field} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                  {row.field}
                </dt>
                <dd className="min-w-0 truncate font-mono text-sm text-slate-100">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-white/10 px-5 py-4">
            <p className="text-xs leading-relaxed text-slate-400">
              Illustrative athlete profile demonstrating self-attested projection fields. Ownership
              review is separate from sharing — the reviewed badge appears only after approval.
            </p>
            <Link
              href="/players"
              className="text-accent-300 mt-2 inline-flex min-h-[44px] items-center text-sm font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore player registry
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
