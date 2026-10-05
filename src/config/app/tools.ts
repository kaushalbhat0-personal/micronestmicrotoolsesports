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
    name: "Sponsor Sentinel",
    description: "Proof-of-performance for sponsors — Twitch VOD scanning",
    href: "/dashboard/sponsor-sentinel",
    icon: "ShieldCheck",
  },
  {
    slug: "scrim-matchmaker",
    name: "Scrim Matchmaker",
    description: "Cross-timezone scrim finding & pinger",
    href: "/dashboard/scrim-matchmaker",
    icon: "CalendarSearch",
    comingSoon: true,
  },
  {
    slug: "prize-splitter",
    name: "Prize Pool Splitter",
    description: "Split a prize pool in seconds — deterministic payouts",
    href: "/dashboard/prize-splitter",
    icon: "Split",
  },
  {
    slug: "vod-clipper",
    name: "VOD Clipper",
    description: "Timestamp & voice-note clipping",
    href: "/dashboard/vod-clipper",
    icon: "Scissors",
    comingSoon: true,
  },
  {
    slug: "roster-sentinel",
    name: "Roster Sentinel",
    description: "Visa & contract tracking",
    href: "/dashboard/roster-sentinel",
    icon: "FileCheck",
    comingSoon: true,
  },
];

export const ALL_ACCESS_SLUG = "all-access";

export function getToolBySlug(slug: string) {
  return TOOLS.find((t) => t.slug === slug);
}
