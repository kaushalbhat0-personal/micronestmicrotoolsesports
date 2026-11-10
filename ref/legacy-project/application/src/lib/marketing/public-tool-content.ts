import type { Metadata } from "next";
import {
  BGMI_LAB_TOOLS,
  getAvailableBgmiLabTools,
  getBgmiLabTool,
  getRoutableBgmiLabTools,
  isLabSlugRoutable,
  type BgmiLabTool,
} from "@/config/public/bgmi-lab";

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

export function getRoutableLabTools() {
  return getRoutableBgmiLabTools();
}

export function isLabRoutableSlug(slug: string): boolean {
  return isLabSlugRoutable(slug);
}

/** Canonical app URL source — same convention as sitemap.ts / robots.ts. */
export function labSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function labAbsoluteUrl(path: string): string {
  return `${labSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function labSitemapPaths(): string[] {
  return ["/bgmi-lab", ...getAvailableBgmiLabTools().map((t) => `/bgmi-lab/${t.slug}`)];
}

/** Reusable metadata constructor — preserves canonical + indexing semantics. */
export function buildLabMetadata(tool: BgmiLabTool): Metadata {
  const base: Metadata = {
    title: `${tool.name} — ${tool.tagline} | MicroNest BGMI Lab`,
    description: tool.description,
    alternates: { canonical: `/bgmi-lab/${tool.slug}` },
    openGraph: {
      title: `${tool.name} — ${tool.tagline}`,
      description: tool.description,
      url: `/bgmi-lab/${tool.slug}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: tool.name, description: tool.tagline },
  };
  if (tool.status === "experimental") {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

export function buildLabJsonLd(tool: BgmiLabTool): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description: tool.description,
    url: labAbsoluteUrl(`/bgmi-lab/${tool.slug}`),
    isPartOf: { "@type": "WebSite", name: "MicroNest", url: labSiteUrl() },
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

/** ItemList for the /bgmi-lab index — available tools only, absolute URLs. */
export function buildLabItemListJsonLd(): Record<string, unknown> {
  const tools = getAvailableBgmiLabTools();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "BGMI Lab — free BGMI practice drills",
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.name,
      url: labAbsoluteUrl(`/bgmi-lab/${tool.slug}`),
      item: {
        "@type": "SoftwareApplication",
        name: tool.name,
        url: labAbsoluteUrl(`/bgmi-lab/${tool.slug}`),
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
      },
    })),
  };
}

/**
 * Related Lab games: same category first, then the rest. Archived excluded.
 * Maximum 3. Callers decide linkability (only routable slugs get links —
 * planned entries render as non-link "Planned" cards, never thin pages).
 */
export function getRelatedLabTools(slug: string, limit = 3): BgmiLabTool[] {
  const current = getBgmiLabTool(slug);
  if (!current) return [];
  const others = BGMI_LAB_TOOLS.filter((t) => t.slug !== slug && t.status !== "archived");
  const sameCategory = others.filter((t) => t.category === current.category);
  const rest = others.filter((t) => t.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}
