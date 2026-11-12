// Homepage tournament showcase (Stitch-approved composition).
// Directory mandate: MicroNest is a discovery and promotion directory. We do
// not operate brackets, live scoring, prize distribution, or prize escrow.
// All organizer details are self-declared.
//
// Product accuracy: the homepage is static and performs no data fetching, so
// it never invents tournaments. Listings below are explicitly labelled
// illustrative format specimens; the only working action is the directory
// link (/tournaments). No dates, prizes, eligibility, or registration URLs
// are fabricated.

import Link from "next/link";
import { MarketingCTA } from "./cta-button";
import { MarketingSection } from "./section";

const specimens: Array<{
  title: string;
  kind: string;
  rows: Array<{ label: string; value: string }>;
  note: string;
}> = [
  {
    title: "Community tournament specimen",
    kind: "Illustrative listing format",
    rows: [
      { label: "Title", value: "BGMI (Squad TPP)" },
      { label: "Region", value: "Regional circuit" },
      { label: "Entry", value: "Free / specified" },
      { label: "Organizer", value: "Community organizer (self-declared)" },
    ],
    note: "MicroNest serves as a discovery directory and does not host brackets, escrow prize pools, or verify organizer credentials.",
  },
  {
    title: "Illustrative scrim series",
    kind: "Specimen",
    rows: [
      { label: "Game", value: "BGMI Squad" },
      { label: "Region", value: "Regional circuit" },
      { label: "Eligibility", value: "Open grassroots rosters" },
      { label: "Organizer", value: "Community host (self-declared)" },
    ],
    note: "Demonstrative scrimmage ladder format showing self-declared host details.",
  },
  {
    title: "Community invitational",
    kind: "Specimen",
    rows: [
      { label: "Game", value: "BGMI (TPP)" },
      { label: "Region", value: "Regional circuit" },
      { label: "Eligibility", value: "Open tournament squads" },
      { label: "Organizer", value: "Independent host (self-declared)" },
    ],
    note: "Demonstrative tournament card format. Zero platform escrow.",
  },
];

export function TournamentShowcase() {
  return (
    <MarketingSection
      id="tournaments"
      eyebrow="Community & semi-pro circuits"
      title="Tournament directory"
      lede="Directory mandate: MicroNest is a tournament discovery and promotion directory. We do not operate brackets, live scoring, prize distribution, or prize escrow. All organizer details are self-declared."
    >
      <p
        role="status"
        className="border border-slate-light bg-steel-100 px-4 py-3 text-sm leading-relaxed text-steel-ink"
      >
        No tournaments are listed on this preview. The live directory below is
        the source of truth — open it to see what is actually published.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <MarketingCTA href="/tournaments" variant="dark">
          Open tournament directory
        </MarketingCTA>
      </div>
      <ul className="mt-8 grid gap-px overflow-hidden border border-slate-light bg-slate-light lg:grid-cols-3">
        {specimens.map((specimen) => (
          <li key={specimen.title} className="flex flex-col bg-paper p-6">
            <p className="text-[11px] font-bold tracking-[0.16em] text-ink-600 uppercase">
              Illustrative specimen — demo data only
            </p>
            <h3 className="font-display mt-2 text-lg font-extrabold tracking-tight uppercase">
              {specimen.title}
            </h3>
            <p className="mt-1 text-xs font-semibold tracking-wide text-ink-600 uppercase">
              {specimen.kind}
            </p>
            <dl className="mt-4 divide-y divide-ink-900/10 border-y border-ink-900/10">
              {specimen.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-xs font-bold tracking-wide text-ink-600 uppercase">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 truncate text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-ink-600">{specimen.note}</p>
            <Link
              href="/tournaments"
              className="mt-4 inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Browse the live directory
              <span aria-hidden="true" className="ml-1">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
