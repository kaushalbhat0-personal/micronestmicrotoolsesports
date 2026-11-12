import type { Metadata } from "next";
import { ArenaHero } from "@/components/marketing/arena-hero";
import { AudiencePathways } from "@/components/marketing/audience-pathways";
import { ClosingCTA } from "@/components/marketing/closing-cta";
import { EditorialGuides } from "@/components/marketing/editorial-guides";
import { ToolsShowcase } from "@/components/marketing/tools-showcase";
import { TournamentShowcase } from "@/components/marketing/tournament-showcase";
import { buildMarketingCanonical } from "@/lib/canonical";

const homeCanonical = buildMarketingCanonical("/");

export const metadata: Metadata = {
  title: "Where esports talent gets discovered",
  description:
    "MicroNest Esports is an open, transparent discovery directory for players, teams, organizations and brands — starting with BGMI — plus zero-telemetry client-side esports utilities. Only opted-in players appear.",
  ...(homeCanonical === undefined
    ? {}
    : { alternates: { canonical: homeCanonical } }),
  openGraph: {
    type: "website",
    title: "MicroNest Esports — Where esports talent gets discovered",
    description:
      "Opt-in player discovery, self-declared team rosters, community tournament listings, editorial templates and client-side esports tools — starting with BGMI.",
    ...(homeCanonical === undefined ? {} : { url: homeCanonical }),
    // No OG images: the brand ships no photography or artwork, and no
    // image is fabricated to fill the slot.
  },
};

// Stitch-approved homepage: fully static server-component composition.
// No data fetching (marketing layer never touches Supabase), no signup CTA,
// no fabricated listings. Every CTA links to a real application route;
// tournament/editorial sections render intentional empty states with
// explicitly labelled illustrative specimens.
export default function HomePage() {
  return (
    <>
      <ArenaHero />
      <AudiencePathways />
      <TournamentShowcase />
      <EditorialGuides />
      <ToolsShowcase />
      <ClosingCTA />
    </>
  );
}
