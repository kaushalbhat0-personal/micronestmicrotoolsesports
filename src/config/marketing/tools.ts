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
    shortDescription: "Know if every creator posted what the sponsor paid for",
    longDescription:
      "Sponsorship Tracking is subscription software that helps esports creators, teams and organizations verify that creator content meets sponsor requirements — and keeps proof organized. MicroNest provides the tracking tools; customers manage their sponsor relationships. Note: Kick live and channel checks are supported; Kick recorded-video (VOD) checks aren't supported yet.",
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
    shortDescription: "Split any prize pool fairly in seconds, with a shareable result",
    longDescription:
      "Prize Pool Splitter is subscription software that helps tournament operators calculate and organize prize-pool distributions. Choose percentage, equal, ranked, or custom splits and generate reconciled, shareable payout tables in your workspace. Results aren't saved in your workspace — copy, print, or share the result when you're done. MicroNest does not hold, escrow, or transfer prize money.",
    audience: ["Tournament organizers", "Esports teams"],
    features: [
      "Exact totals — reconciled to the last cent, no rounding drift",
      "INR / USD / EUR / GBP with correct locale formatting",
      "Percentage, equal, ranked (Top 3–Top 10) and custom splits",
      "Discord / WhatsApp / X-ready copy with one click",
      "Shareable payout link (the link carries your result, so no account is needed to view it) + CSV + Print",
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
    slug: "draft-ban",
    name: "Draft & Ban",
    shortDescription: "Run pick/ban drafts live with a record both teams can trust",
    longDescription:
      "Draft & Ban is subscription software that helps esports teams and organizers run match drafts with a standard veto sequence — and keeps locked, shareable official records. Available now.",
    audience: ["Esports teams", "Coaches and managers", "Tournament organizers"],
    features: ["Template-first draft setup", "Deterministic ban/pick sequence", "Locked official records with their own record numbers", "Shareable result links", "Draft history and run-again workflow"],
    status: "available",
    internalSlug: "draft-ban",
    icon: "Swords",
    seoTitle: "Esports Draft & Ban | MicroNest",
    seoDescription:
      "Subscription software to run match drafts and keep official records. Draft & Ban for esports teams and organizers — available now.",
    number: "T06",
    accent: "teal",
    motif: "Ban · Pick · Lock",
  },
  {
    slug: "tie-breaker",
    name: "Tie-Breaker Resolver",
    shortDescription: "Settle tied standings with rules everyone can see",
    longDescription:
      "Tie-Breaker Resolver is subscription software that helps tournament organizers apply ranking rules in order, explain every tied placement in plain language, and lock a shareable official result with its own record number. Available now.",
    audience: ["Tournament organizers", "League administrators", "Esports teams"],
    features: [
      "Ordered ranking rules with editable presets",
      "Deterministic tie resolution with plain-language explanations",
      "Locked official records with their own record numbers",
      "Shareable result links",
      "Competition history and copy for the next event",
    ],
    status: "available",
    internalSlug: "tie-breaker",
    icon: "Scale",
    seoTitle: "Esports Tie-Breaker Resolver | MicroNest",
    seoDescription:
      "Subscription software to resolve tied standings with official, explainable records. Tie-Breaker Resolver for tournament organizers — available now.",
    number: "T07",
    accent: "teal",
    motif: "Pts · H2H · Lock",
  },
  {
    slug: "prize-payout-tracker",
    name: "Prize Payout Tracker",
    shortDescription: "Publish a public payout list — who's paid, what's pending",
    longDescription:
      "Prize Payout Tracker is subscription software that helps tournament organizers publish a public, organizer-reported record of prize payouts — who has been paid, what remains pending, and the payout deadline. Available now. MicroNest does not hold, escrow, transfer, or verify prize money.",
    audience: ["Tournament organizers", "League administrators", "Esports teams"],
    features: [
      "Create a payout tracker with recipients and amounts",
      "Publish one public shareable payout page",
      "Mark recipients paid as payouts happen",
      "Deadline and progress the public can see",
      "Revocable share links",
    ],
    status: "available",
    internalSlug: "payout-tracker",
    icon: "ReceiptText",
    seoTitle: "Prize Payout Tracker for Esports Tournaments | MicroNest",
    seoDescription:
      "Subscription software to publish a public, organizer-reported prize payout list — who's paid, what's pending, and the deadline. A focused MicroNest tool for tournament organizers.",
    number: "T08",
    accent: "charcoal",
    motif: "Paid · Pending · Public",
  },
];

export function getMarketingTool(slug: string) {
  return MARKETING_TOOLS.find((t) => t.slug === slug);
}

export function getAvailableTools() {
  return MARKETING_TOOLS.filter((t) => t.status === "available");
}
