// Homepage discovery pathways: four Stitch-approved lanes, all deep-linked
// to real application routes. Copy is consent-first and self-declared — no
// verification, ranking, or exclusivity claims. Static only.

import Link from "next/link";
import type { Route } from "next";
import { MarketingSection } from "./section";

type Pathway = {
  seed: string;
  name: string;
  tag: string;
  copy: string;
  href: Route;
  action: string;
};

const pathways: Array<Pathway> = [
  {
    seed: "01",
    name: "Players",
    tag: "Opt-in athlete directory",
    copy: "Consent-first discovery for grassroots and aspiring athletes. Self-declared tactical roles and roster availability.",
    href: "/players",
    action: "Browse players",
  },
  {
    seed: "02",
    name: "Teams",
    tag: "Self-declared rosters",
    copy: "Transparent directories of independent and grassroots squad rosters, declared vacancies, and trial announcements.",
    href: "/teams",
    action: "View teams",
  },
  {
    seed: "03",
    name: "Organizations",
    tag: "Competitive guilds & clubs",
    copy: "Emerging, collegiate, and independent esports organizations establishing regional presence and scouting talent.",
    href: "/organizations",
    action: "Explore orgs",
  },
  {
    seed: "04",
    name: "Brands",
    tag: "Ecosystem partners",
    copy: "Endemic hardware makers, foundations, and community partners connecting with grassroots circuits and creators.",
    href: "/brands",
    action: "Partner directory",
  },
];

export function AudiencePathways() {
  return (
    <MarketingSection
      id="discovery"
      eyebrow="System architecture"
      title="The discovery ecosystem"
      lede="Structured discovery pathways designed for serious competitive growth — without predatory barriers or platform lock-in. Every lane below is a real directory."
    >
      <ul className="divide-y divide-ink-900/10 border-y-2 border-ink-900">
        {pathways.map((pathway) => (
          <li
            key={pathway.seed}
            className="grid gap-2 py-5 sm:grid-cols-[3rem_10rem_1fr_auto] sm:items-center sm:gap-6"
          >
            <span aria-hidden="true" className="font-display text-2xl font-extrabold text-accent-600">
              {pathway.seed}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="font-display text-xl font-extrabold tracking-tight uppercase">
                {pathway.name}
              </h3>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.16em] text-ink-600 uppercase">
                {pathway.tag}
              </p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base">
                {pathway.copy}
              </p>
            </div>
            <div className="sm:text-right">
              <Link
                href={pathway.href}
                className="inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                {pathway.action}
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
