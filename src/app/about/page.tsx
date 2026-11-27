import type { Metadata } from "next";
import { ClosingCTA } from "@/components/marketing/closing-cta";
import { MarketingCTA } from "@/components/marketing/cta-button";
import { MarketingSection, SectionEyebrow } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { buildMarketingCanonical } from "@/lib/canonical";

const aboutCanonical = buildMarketingCanonical("/about");

export const metadata: Metadata = {
  title: `About ${siteConfig.name}`,
  description: `What ${siteConfig.name} is: a ${siteConfig.category.toLowerCase()} for competitive players — create and share identity immediately, get BGMI ownership reviewed for the public registry, and use client-side esports tools. Starting with BGMI.`,
  ...(aboutCanonical === undefined
    ? {}
    : { alternates: { canonical: aboutCanonical } }),
  openGraph: {
    type: "website",
    title: `About — ${siteConfig.name}`,
    description: `${siteConfig.tagline}. Create and share your competitive identity; ownership review unlocks the public player registry.`,
    ...(aboutCanonical === undefined ? {} : { url: aboutCanonical }),
  },
};

// Availability tiers (factual route + reader contracts). Ownership evidence
// and reviewed badge are live; registry discovery requires approval (C1A).
type AvailabilityState = "Live now" | "Directory live" | "Planned";

const served: Array<{
  name: string;
  copy: string;
  status: AvailabilityState;
}> = [
  {
    name: "Players",
    copy: "Public profiles, PNG share cards, and a filterable registry. Share anytime; registry appearance requires approved BGMI ownership plus opt-in completeness.",
    status: "Live now",
  },
  {
    name: "Teams",
    copy: "Directory route with filters and honest empty states. Roster data appears only after backend activation — nothing is fabricated meanwhile.",
    status: "Directory live",
  },
  {
    name: "Organizations",
    copy: "Directory route with filters and honest empty states. Organization data appears only after backend activation.",
    status: "Directory live",
  },
  {
    name: "Brands",
    copy: "Directory route with filters and honest empty states. Declared interests are shown only after backend activation — intent, never availability claims.",
    status: "Directory live",
  },
];

const availability: Array<{ capability: string; state: AvailabilityState }> = [
  { capability: "Public player profile pages and shareable URLs", state: "Live now" },
  { capability: "Player PNG share cards (no ownership review required)", state: "Live now" },
  { capability: "BGMI ownership evidence submission and manual review", state: "Live now" },
  { capability: "Ownership-reviewed badge (approved + currently valid only)", state: "Live now" },
  { capability: "Public player registry (ownership-gated search)", state: "Live now" },
  { capability: "Discoverability consent and per-game visibility", state: "Live now" },
  { capability: "Avatar upload, handle changes, profile deletion", state: "Live now" },
  { capability: "Prize Pool Splitter (client-side calculator)", state: "Live now" },
  { capability: "Roster & Slot Builder (client-side planner)", state: "Live now" },
  { capability: "Tie-Break & Qualification Simulator (client-side)", state: "Live now" },
  { capability: "Team directory route (filters, empty/unavailable states)", state: "Directory live" },
  { capability: "Organization directory route", state: "Directory live" },
  { capability: "Brand directory route", state: "Directory live" },
  { capability: "Organizer directory route", state: "Directory live" },
  { capability: "Tournament directory route", state: "Directory live" },
  { capability: "News directory route", state: "Directory live" },
  { capability: "Opportunities, applications and recruitment workflows", state: "Planned" },
  { capability: "Mini games", state: "Planned" },
];

function StatusBadge({ state }: { state: AvailabilityState }) {
  if (state === "Live now") {
    return (
      <span className="inline-block rounded-none bg-accent-600 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase">
        Live now
      </span>
    );
  }
  if (state === "Directory live") {
    return (
      <span className="inline-block rounded-none border border-accent-600 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-accent-600 uppercase">
        Directory live
      </span>
    );
  }
  return (
    <span className="inline-block rounded-none border border-ink-900/25 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-ink-600 uppercase">
      Planned
    </span>
  );
}

export default function AboutPage() {
  return (
    <>
      <div className="w-full bg-arena-950 text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionEyebrow tone="arena">About</SectionEyebrow>
          <h1 className="font-display mt-5 max-w-3xl text-[clamp(2.5rem,7vw,4rem)] leading-[0.95] font-extrabold tracking-tight uppercase">
            About {siteConfig.name}
          </h1>
          <p className="mt-2 text-sm font-bold tracking-[0.16em] text-accent-300 uppercase">
            {siteConfig.tagline}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {siteConfig.name} is a {siteConfig.category.toLowerCase()} that helps competitive
            players create identity, share cards, and become discoverable after BGMI ownership
            review — starting with BGMI, architected for every title.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MarketingCTA href="/players">Explore player registry</MarketingCTA>
            <MarketingCTA href="/" variant="ghost-on-dark">
              Back to home
            </MarketingCTA>
          </div>
        </div>
      </div>

      <MarketingSection
        id="problem"
        eyebrow="The problem"
        title="Esports discovery is fragmented"
        lede="Talent hides in scattered tryout posts, direct messages and spreadsheets. Teams scout by word of mouth, organizations run operations on gut feel, and brands cannot tell who is real, available or relevant. Every side of the ecosystem is searching — none of them in the same place."
      >
        <div className="grid gap-px overflow-hidden rounded-none border border-steel-200 bg-steel-200 md:grid-cols-3">
          {[
            {
              title: "Players are invisible",
              copy: "Skill without a discoverable home stays unseen, no matter how much grind sits behind it.",
            },
            {
              title: "Teams scout blind",
              copy: "No shared directory means recruitment runs on who-you-know instead of who-can-play.",
            },
            {
              title: "Orgs and brands guess",
              copy: "Partnership decisions get made without a trustworthy map of the competitive landscape.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-paper p-6">
              <h3 className="text-base font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.copy}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        id="vision"
        tone="steel"
        eyebrow="The vision"
        title="Where competition connects"
        lede="Create and share your competitive identity immediately. Get BGMI ownership reviewed to appear in the public player registry. Consent-first throughout — nothing is public in the registry unless a player opts in and ownership is currently approved."
      >
        <ul className="grid gap-4 md:grid-cols-2">
          {served.map((audience) => (
            <li
              key={audience.name}
              className="rounded-none border border-steel-200 bg-paper p-6"
            >
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-display text-lg font-extrabold tracking-tight uppercase">
                  {audience.name}
                </span>
                <StatusBadge state={audience.status} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{audience.copy}</p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection
        id="bgmi-direction"
        eyebrow="Game direction"
        title="BGMI-first, multi-title-ready"
        lede="The network launches with Battlegrounds Mobile India because that is where the competition already is. Per-game profiles, game-aware directory filters and a projection shaped around titles mean new games extend the catalogue — they never require a rebuild. No exclusivity is implied and no competitive claims are made."
      >
        <p className="max-w-2xl border-l-2 border-accent-600 pl-6 text-base leading-relaxed text-ink-600">
          One active title today, a catalogue built for many: every profile,
          filter and listing already carries its game with it.
        </p>
      </MarketingSection>

      <MarketingSection
        id="availability"
        tone="steel"
        eyebrow="Availability statement"
        title="What exists today — and what does not"
        lede="This page is the contract. “Live now” runs on real data today. “Directory live” means the route, filters and honest empty or temporarily-unavailable states ship — not that listings exist. “Planned” has no route workflow and nothing to join until it ships. Directory live never means populated: no listing is ever fabricated."
      >
        <ul className="divide-y divide-ink-900/10 border-y-2 border-ink-900">
          {availability.map((row) => (
            <li
              key={row.capability}
              className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <span className="text-sm font-semibold sm:text-base">{row.capability}</span>
              <span className="w-fit shrink-0">
                <StatusBadge state={row.state} />
              </span>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <ClosingCTA
        title="See what is live for yourself."
        copy="Create a profile, share your PNG, and browse the ownership-reviewed player registry. Client-side tools run in your browser — then judge the roadmap against working software."
      />
    </>
  );
}
