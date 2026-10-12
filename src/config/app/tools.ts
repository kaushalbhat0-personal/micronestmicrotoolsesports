/**
 * Tool registry — single source of truth for tool metadata.
 * Database `tools` table is the persistence layer; this config drives UI/nav availability.
 * Keep in sync via seed.
 */

export interface ToolConfig {
  slug: string;
  name: string;
  description: string;
  href: string;
  icon: string; // lucide icon name
  comingSoon?: boolean;
}

export const TOOLS: ToolConfig[] = [
  {
    slug: "sponsor-sentinel",
    name: "Sponsorship Tracking",
    description: "Proof-of-performance for sponsors — Twitch VOD scanning",
    href: "/dashboard/sponsor-sentinel",
    icon: "ShieldCheck",
  },
  {
    slug: "prize-splitter",
    name: "Prize Pool Splitter",
    description: "Split a prize pool in seconds — deterministic payouts",
    href: "/dashboard/prize-splitter",
    icon: "Split",
  },
  {
    slug: "draft-ban",
    name: "Draft & Ban",
    description: "Professional match draft room — run vetoes and lock official records",
    href: "/dashboard/draft-ban",
    icon: "Swords",
  },
  {
    slug: "tie-breaker",
    name: "Tie-Breaker Resolver",
    description: "Official standings for tied competitions — explained, locked, shareable",
    href: "/dashboard/tie-breaker",
    icon: "Scale",
  },
  {
    slug: "payout-tracker",
    name: "Prize Payout Tracker",
    description: "Publish a public, organizer-reported record of tournament prize payouts",
    href: "/dashboard/payout-tracker",
    icon: "ReceiptText",
  },
];

export const ALL_ACCESS_SLUG = "all-access";

export function getToolBySlug(slug: string) {
  return TOOLS.find((t) => t.slug === slug);
}
