import type { Metadata } from "next";
import { ClosingCTA } from "@/components/marketing/closing-cta";
import { MarketingCTA } from "@/components/marketing/cta-button";
import { MarketingSection, SectionEyebrow } from "@/components/marketing/section";
import { buildMarketingCanonical } from "@/lib/canonical";

const aboutCanonical = buildMarketingCanonical("/about");

export const metadata: Metadata = {
  title: "About the platform",
  description:
    "What MicroNest Esports is: a connected esports discovery ecosystem for players, teams, organizations and brands. Player discovery and client-side tools are live now, starting with BGMI; team, organization, brand, organizer, tournament and news directories ship as honest shells pending backend activation.",
  ...(aboutCanonical === undefined
    ? {}
    : { alternates: { canonical: aboutCanonical } }),
  openGraph: {
    type: "website",
    title: "About — MicroNest Esports",
    description:
      "A connected esports discovery ecosystem. Player discovery and esports tools are live now; further directories are live shells pending data activation.",
    ...(aboutCanonical === undefined ? {} : { url: aboutCanonical }),
  },
};

// P14-B3 availability tiers. Factual basis (route code + reader contracts):
// - "Live now": player directory/profile/consent/avatar/handle/deletion read
//   through the APPROVED D-G1-03 RPC-only DirectoryReader (G1-6); the three
//   tools run entirely in the browser from the static registry (P5/P6/P7).
// - "Directory live": the route shell (filters, pagination, skeletons,
//   invalid/unavailable/empty states) ships and links are real, but reads
//   resolve through PROPOSED or UNAPPLIED masked RPC pairs, so listings
//   render empty or temporarily-unavailable states — never fabricated rows.
//   Teams: D1 masked RPC pair, migrations local UNAPPLIED. Organizations and
//   brands: PROPOSED RPC pair, no migration exists. Organizers: PROPOSED RPC
//   pair, migration local-only. Tournaments and news: PROPOSED RPC pair, no
//   migration exists.
// - "Planned": no route workflow exists — publishing, ownership/verification
//   writes, opportunities, applications/recruitment, mini games.
type AvailabilityState = "Live now" | "Directory live" | "Planned";

const served: Array<{
  name: string;
  copy: string;
  status: AvailabilityState;
}> = [
  {
    name: "Players",
    copy: "Public profiles and a filterable directory, live today with consent-first discoverability controls.",
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
  { capability: "Public player directory with filters", state: "Live now" },
  { capability: "Public player profile pages", state: "Live now" },
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
  { capability: "Publishing, ownership and verification writes", state: "Planned" },
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
            About MicroNest Esports
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            MicroNest Esports is a connected esports discovery ecosystem that
            helps players, teams, organizations and brands discover one
            another — starting with BGMI, architected for every title.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MarketingCTA href="/players">Explore players</MarketingCTA>
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
        title="One place where the ecosystem meets"
        lede="A single discovery loop: players make themselves findable, and the teams, organizations and brands around them can actually find them. Consent-first throughout — nothing is public unless a player chooses it."
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
        lede="The platform launches with Battlegrounds Mobile India because that is where the competition already is. Per-game profiles, game-aware directory filters and a projection shaped around titles mean new games extend the catalogue — they never require a rebuild. No exclusivity is implied and no competitive claims are made."
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
        copy="The player directory is open and the esports tools run in your browser. Browse real, opted-in listings — then judge the roadmap against working software."
      />
    </>
  );
}
