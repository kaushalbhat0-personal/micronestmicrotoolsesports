// Homepage editorial showcase (Stitch-approved composition).
// Accuracy contract: the homepage performs no article fetching, so nothing
// below is presented as published reporting. Every card is an explicitly
// labelled editorial/operational concept template; the only working action is
// the news directory link (/news). No invented headlines, authors, dates, or
// article slugs.

import Link from "next/link";
import { MarketingCTA } from "./cta-button";
import { MarketingSection } from "./section";

const guides: Array<{
  kind: string;
  title: string;
  copy: string;
  action: string;
}> = [
  {
    kind: "Desk reference — independent organizer blueprint",
    title: "Grassroots tournament rulebook & dispute protocols",
    copy: "Standard rulebook structures, match replay review workflows, and referee escalation frameworks for community leagues.",
    action: "Read concept",
  },
  {
    kind: "Game update brief",
    title: "BGMI balance analysis & vehicle mechanics",
    copy: "Technical breakdown of vehicle durability adjustments and fast rotation viability across competitive Erangel circles.",
    action: "Read concept",
  },
  {
    kind: "Operational template",
    title: "Contract checklist for semi-pro mobile rosters",
    copy: "Prize distribution, scrim commitments, and termination terms for players and squad managers.",
    action: "Read template",
  },
  {
    kind: "Governance brief",
    title: "Understanding consent & directory opt-in architecture",
    copy: "Why opt-in architecture and instant profile de-indexing are necessary safeguards for grassroots athletes.",
    action: "Read policy brief",
  },
];

export function EditorialGuides() {
  return (
    <MarketingSection
      id="editorial"
      tone="steel"
      eyebrow="Dispatches & templates"
      title="Esports editorial & operational guides"
      lede="Editorial and governance templates provided for reference only. Not active journalistic reporting or endorsed legal advice. Published stories appear only in the news directory."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <MarketingCTA href="/news" variant="dark">
          View the news directory
        </MarketingCTA>
      </div>
      <ul className="mt-8 grid gap-px overflow-hidden border border-slate-light bg-slate-light sm:grid-cols-2">
        {guides.map((guide) => (
          <li key={guide.title} className="flex flex-col bg-paper p-6">
            <p className="text-[11px] font-bold tracking-[0.16em] text-ink-600 uppercase">
              Editorial concept — sample template
            </p>
            <p className="mt-2 text-xs font-semibold tracking-wide text-ink-600 uppercase">
              {guide.kind}
            </p>
            <h3 className="mt-1 text-base font-bold leading-snug">{guide.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{guide.copy}</p>
            <Link
              href="/news"
              className="mt-4 inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              aria-label={`${guide.action}: ${guide.title} (opens the news directory)`}
            >
              {guide.action}
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
