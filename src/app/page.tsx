import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ToolboxHero } from "@/components/marketing/homepage/toolbox-hero";
import { PillarSection } from "@/components/marketing/homepage/pillar-section";
import { LabFeatureSection } from "@/components/marketing/homepage/lab-feature-section";
import { ToolboxGroups } from "@/components/marketing/homepage/toolbox-groups";
import { CompetitionStrip } from "@/components/marketing/homepage/competition-strip";
import { HowItWorks } from "@/components/marketing/homepage/how-it-works";
import { PricingReassurance } from "@/components/marketing/homepage/pricing-reassurance";
import { PhilosophySection } from "@/components/marketing/homepage/philosophy-section";
import { TrustSection } from "@/components/marketing/homepage/trust-section";
import { FinalToolboxCTA } from "@/components/marketing/homepage/final-toolbox-cta";
import {
  HOMEPAGE_DESCRIPTION,
  HOMEPAGE_TITLE,
  buildHomepageItemListJsonLd,
  buildHomepageOrganizationJsonLd,
  buildHomepageWebsiteJsonLd,
} from "@/lib/marketing/homepage-seo";

export const metadata: Metadata = {
  // Toolbox-first identity: MicroNest is the product; tools live inside it.
  // `absolute` bypasses the "%s | MicroNest" template so the canonical
  // toolbox title renders exactly once.
  title: { absolute: HOMEPAGE_TITLE },
  description: HOMEPAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MicroNest — The toolbox behind esports" }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

/**
 * Toolbox homepage — fully static, no data fetching. MicroNest itself is the
 * subject; every tool is equally discoverable. Section order is the IA:
 * hero → pillars → lab feature → toolbox → competition → how-it-works →
 * pricing → philosophy → trust → CTA.
 */
export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <ToolboxHero />
        <PillarSection />
        <LabFeatureSection />
        <ToolboxGroups />
        <CompetitionStrip />
        <HowItWorks />
        <PricingReassurance />
        <PhilosophySection />
        <TrustSection />
        <FinalToolboxCTA />
      </main>
      <Footer />
      {/* Structured data — toolbox identity: Organization + WebSite + ItemList. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildHomepageOrganizationJsonLd(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildHomepageWebsiteJsonLd(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildHomepageItemListJsonLd()),
        }}
      />
    </div>
  );
}
