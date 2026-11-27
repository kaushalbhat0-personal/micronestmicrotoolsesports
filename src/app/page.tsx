import type { Metadata } from "next";
import { ArenaHero } from "@/components/marketing/arena-hero";
import { AudiencePathways } from "@/components/marketing/audience-pathways";
import { ClosingCTA } from "@/components/marketing/closing-cta";
import { EditorialGuides } from "@/components/marketing/editorial-guides";
import { ToolsShowcase } from "@/components/marketing/tools-showcase";
import { TournamentShowcase } from "@/components/marketing/tournament-showcase";
import { siteConfig } from "@/config/site";
import { buildMarketingCanonical } from "@/lib/canonical";

const homeCanonical = buildMarketingCanonical("/");

export const metadata: Metadata = {
  title: siteConfig.tagline,
  description: siteConfig.description,
  ...(homeCanonical === undefined
    ? {}
    : { alternates: { canonical: homeCanonical } }),
  openGraph: {
    type: "website",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    ...(homeCanonical === undefined ? {} : { url: homeCanonical }),
    // No OG images until an approved brand asset ships (interim mark only).
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
