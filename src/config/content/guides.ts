export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  audience: string[];
  category: string;
  publishedAt: string; // ISO date, no fake future
  updatedAt?: string;
  primaryTool: string; // marketing tool slug
  related: {
    tool: string;
    glossary: string[];
    useCase?: string;
    guide?: string;
  };
}

export const GUIDES: GuideMeta[] = [
  {
    slug: "esports-sponsorship-deliverables",
    title: "Esports Sponsorship Deliverables Checklist: What Sponsors Actually Expect",
    description:
      "A practical checklist of common esports sponsorship deliverables — and how to turn vague sponsor requests into measurable campaign requirements.",
    audience: ["Esports organizations", "Esports teams", "Sponsorship managers"],
    category: "Sponsorship",
    publishedAt: "2026-10-10",
    primaryTool: "sponsorship-tracking",
    related: {
      tool: "sponsorship-tracking",
      glossary: ["sponsorship-deliverable", "proof-of-performance"],
      useCase: "esports-organizations",
      guide: "proving-sponsored-content",
    },
  },
  {
    slug: "proving-sponsored-content",
    title: "How to Prove Sponsored Content Was Published: From Requirement to Proof",
    description:
      "A clear workflow for turning a sponsor requirement into verifiable proof — from published content to check, proof and result.",
    audience: ["Esports creators", "Esports organizations", "Sponsorship managers"],
    category: "Sponsorship",
    publishedAt: "2026-10-11",
    primaryTool: "sponsorship-tracking",
    related: {
      tool: "sponsorship-tracking",
      glossary: ["proof-of-performance", "sponsorship-deliverable"],
      useCase: "esports-organizations",
      guide: "esports-sponsorship-deliverables",
    },
  },
  {
    slug: "esports-prize-pool-distribution",
    title: "Esports Prize Pool Distribution: How to Split Tournament Prize Money",
    description:
      "How tournament organizers split esports prize pools — percentage, equal, ranked and custom methods, with examples for Top 3 to Top 10 and how to keep totals exact.",
    audience: ["Tournament organizers", "Esports teams", "Esports organizations"],
    category: "Prize Pool",
    publishedAt: "2026-10-14",
    primaryTool: "prize-pool-splitter",
    related: {
      tool: "prize-pool-splitter",
      glossary: ["prize-pool", "prize-pool-distribution"],
      useCase: "tournament-organizers",
      guide: "esports-prize-pool-percentage-split",
    },
  },
  {
    slug: "esports-prize-pool-percentage-split",
    title: "How to Split an Esports Prize Pool by Percentage",
    description:
      "How percentage splits work for esports prize pools — with a ₹100,000 example (50/30/20), common structures, validation, and why totals must reconcile.",
    audience: ["Tournament organizers", "Esports teams"],
    category: "Prize Pool",
    publishedAt: "2026-10-15",
    primaryTool: "prize-pool-splitter",
    related: {
      tool: "prize-pool-splitter",
      glossary: ["prize-pool-distribution", "prize-pool"],
      useCase: "tournament-organizers",
      guide: "esports-prize-pool-rounding",
    },
  },
  {
    slug: "esports-prize-pool-rounding",
    title: "How to Handle Prize Pool Rounding and Exact Payout Totals",
    description:
      "Why percentage maths creates fractional payouts and how largest-remainder reconciliation makes prize totals add up exactly — with a ₹100 split three ways: ₹33.34, ₹33.33, ₹33.33.",
    audience: ["Tournament organizers", "Esports teams", "Finance ops"],
    category: "Prize Pool",
    publishedAt: "2026-10-16",
    primaryTool: "prize-pool-splitter",
    related: {
      tool: "prize-pool-splitter",
      glossary: ["prize-pool-distribution", "prize-pool"],
      useCase: "tournament-organizers",
      guide: "esports-prize-pool-distribution",
    },
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
