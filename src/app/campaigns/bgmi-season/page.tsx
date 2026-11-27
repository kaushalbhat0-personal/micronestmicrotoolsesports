import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildMarketingCanonical } from "@/lib/canonical";
import { CampaignCta } from "./_components/campaign-cta";
import { CampaignHero } from "./_components/campaign-hero";
import { CommunitySection } from "./_components/community-section";
import { HowItWorksSection } from "./_components/how-it-works-section";
import { PlayerIdentitySection } from "./_components/player-identity-section";
import { ToolsStrip } from "./_components/tools-strip";

const canonical = buildMarketingCanonical("/campaigns/bgmi-season");

const pageDescription = `Create your ${siteConfig.name} player identity, share your card immediately, and get BGMI ownership reviewed for registry discoverability. Unofficial community campaign — not affiliated with PMGC or KRAFTON.`;

export const metadata: Metadata = {
  title: "Create Your Player Card",
  description: pageDescription,
  robots: { index: false, follow: true },
  ...(canonical === undefined ? {} : { alternates: { canonical } }),
  openGraph: {
    type: "website",
    title: `${siteConfig.name} — Your game. Your identity.`,
    description: pageDescription,
    ...(canonical === undefined ? {} : { url: canonical }),
  },
};

export default function BgmiSeasonCampaignPage() {
  return (
    <div className="bg-paper">
      <CampaignHero />
      <PlayerIdentitySection />
      <HowItWorksSection />
      <CommunitySection />
      <CampaignCta />
      <ToolsStrip />

      <footer className="border-t border-steel-200 bg-steel-100">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <p className="max-w-3xl text-xs leading-relaxed text-ink-600">
            BGMI (Battlegrounds Mobile India) is a registered trademark of KRAFTON, Inc.{" "}
            {siteConfig.name} is an independent {siteConfig.category.toLowerCase()} and is not
            affiliated with, sponsored by, or endorsed by KRAFTON, Inc., any PMGC organizer, or any
            tournament body. This page is an unofficial community campaign. Ownership-reviewed status
            reflects manual evidence review by {siteConfig.name} — not BGMI account validation by the
            publisher.
          </p>
        </div>
      </footer>
    </div>
  );
}
