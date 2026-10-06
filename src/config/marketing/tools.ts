export type MarketingToolStatus = "available" | "coming-soon";

export type ToolAccent = "terracotta" | "charcoal" | "teal" | "beige" | "amber";

export interface MarketingTool {
  slug: string; // public URL slug /tools/:slug
  name: string;
  shortDescription: string;
  longDescription: string;
  audience: string[];
  features: string[];
  status: MarketingToolStatus;
  internalSlug?: string; // maps to TOOLS slug for entitlement
  icon: string;
  seoTitle: string;
  seoDescription: string;
  number: string; // editorial T01—T05, deterministic
  accent: ToolAccent;
  motif: string; // small mono esports-data motif, illustrative
}

export const MARKETING_TOOLS: MarketingTool[] = [
  {
    slug: "sponsorship-tracking",
    name: "Sponsorship Tracking",
    shortDescription: "Verify sponsor requirements and keep proof organized.",
    longDescription:
      "Sponsorship Tracking is subscription software that helps esports creators, teams and organizations verify that creator content meets sponsor requirements — and keeps proof organized. MicroNest provides the tracking tools; customers manage their sponsor relationships.",
    audience: ["Esports creators", "Esports teams", "Esports organizations", "Sponsorship managers"],
    features: [
      "Create sponsor campaigns with clear requirements",
      "Connect creator channels across YouTube, Twitch and Kick",
      "Run checks on eligible content and review results",
      "Proof grouped by content — each video shown once with the requirements it satisfies",
      "Check history and status that is easy to explain to sponsors",
    ],
    status: "available",
    internalSlug: "sponsor-sentinel",
    icon: "ShieldCheck",
    seoTitle: "Sponsorship Tracking for Esports Creators | MicroNest",
    seoDescription:
      "Subscription software to verify sponsor requirements and keep proof organized. Sponsorship Tracking for esports creators, teams and managers — part of MicroNest's focused esports tools.",
    number: "T01",
    accent: "terracotta",
    motif: "#Sponsor · Proof",
  },
  {
    slug: "prize-pool-splitter",
    name: "Prize Pool Splitter",
    shortDescription: "Calculate prize distributions without spreadsheet headaches.",
    longDescription:
      "Prize Pool Splitter is subscription software that helps tournament operators calculate and organize prize-pool distributions. Choose percentage, equal, ranked, or custom splits and generate reconciled, shareable payout tables in your workspace. MicroNest does not hold, escrow, or transfer prize money.",
    audience: ["Tournament organizers", "Esports teams"],
    features: [
      "Exact totals — reconciled to the last cent, no rounding drift",
      "INR / USD / EUR / GBP with correct locale formatting",
      "Percentage, equal, ranked (Top 3–Top 10) and custom splits",
      "Discord / WhatsApp / X-ready copy with one click",
      "Shareable payout link (stateless URL) + CSV + Print",
      "Live 100% validation — Total must equal 100%",
    ],
    status: "available",
    internalSlug: "prize-splitter",
    icon: "Split",
    seoTitle: "Esports Prize Pool Splitter | MicroNest",
    seoDescription:
      "Subscription software to calculate prize distributions without spreadsheet headaches. A focused MicroNest tool for prize pools — available now. Deterministic payouts reconciled to the last cent.",
    number: "T02",
    accent: "charcoal",
    motif: "50 / 30 / 20",
  },
  {
    slug: "scrim-matchmaker",
    name: "Scrim Matchmaker",
    shortDescription: "Coordinate scrims across teams, schedules, and time zones.",
    longDescription:
      "Scrim Matchmaker helps teams find practice opponents without the usual back-and-forth — with time zone aware scheduling at its core.",
    audience: ["Esports teams", "Coaches and managers"],
    features: ["Team availability", "Time zone aware scheduling", "Opponent discovery"],
    status: "coming-soon",
    internalSlug: "scrim-matchmaker",
    icon: "CalendarSearch",
    seoTitle: "Esports Scrim Matchmaker | MicroNest",
    seoDescription:
      "Coordinate scrims across teams, schedules and time zones. A focused MicroNest tool for competitive practice — coming soon.",
    number: "T03",
    accent: "teal",
    motif: "19:00 IST · BO3",
  },
  {
    slug: "vod-clipper",
    name: "VOD Clipper",
    shortDescription: "Organize important moments from competitive content.",
    longDescription:
      "VOD Clipper makes it simple to capture and organize key moments from match recordings for review and sharing.",
    audience: ["Esports creators", "Coaches", "Content teams"],
    features: ["Timestamp capture", "Clip organization", "Quick review workflow"],
    status: "coming-soon",
    internalSlug: "vod-clipper",
    icon: "Scissors",
    seoTitle: "Esports VOD Clipper | MicroNest",
    seoDescription:
      "Save important moments from match recordings for quick review. A focused MicroNest tool for VODs — coming soon.",
    number: "T04",
    accent: "beige",
    motif: "12:34 → 13:07",
  },
  {
    slug: "roster-sentinel",
    name: "Roster Sentinel",
    shortDescription: "Keep roster-related operational information easier to manage.",
    longDescription:
      "Roster Sentinel helps esports organizations keep roster-related information organized and easy to find when it matters.",
    audience: ["Esports organizations", "Team managers"],
    features: ["Roster tracking", "Operational information at a glance", "Team organization"],
    status: "coming-soon",
    internalSlug: "roster-sentinel",
    icon: "FileCheck",
    seoTitle: "Esports Roster Sentinel | MicroNest",
    seoDescription:
      "Keep roster-related operational information easier to manage. A focused MicroNest tool for rosters — coming soon.",
    number: "T05",
    accent: "amber",
    motif: "Contract · 2026",
  },
];

export function getMarketingTool(slug: string) {
  return MARKETING_TOOLS.find((t) => t.slug === slug);
}

export function getAvailableTools() {
  return MARKETING_TOOLS.filter((t) => t.status === "available");
}
