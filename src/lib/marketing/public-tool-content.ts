import { BGMI_LAB_TOOLS, getAvailableBgmiLabTools, getBgmiLabTool, type BgmiLabTool } from "@/config/public/bgmi-lab";

/**
 * Public-tool content helper (Phase 1.1).
 *
 * Presentation-only. Must never import Supabase admin, service role, auth,
 * entitlements, billing, Dodo, Razorpay, or organization services.
 * (Guarded by public-tool-content.guard.test.ts.)
 */

export function getLabTools(): readonly BgmiLabTool[] {
  return BGMI_LAB_TOOLS;
}

export function getLabTool(slug: string): BgmiLabTool | null {
  return getBgmiLabTool(slug);
}

export function getAvailableLabTools(): BgmiLabTool[] {
  return getAvailableBgmiLabTools();
}

export function labSitemapPaths(): string[] {
  return ["/bgmi-lab", ...getAvailableBgmiLabTools().map((t) => `/bgmi-lab/${t.slug}`)];
}

export function buildLabJsonLd(tool: BgmiLabTool): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description: tool.description,
    url: `/bgmi-lab/${tool.slug}`,
    isPartOf: { "@type": "WebSite", name: "MicroNest", url: "/" },
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
  };
}

export function buildLabFaqJsonLd(tool: BgmiLabTool): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
