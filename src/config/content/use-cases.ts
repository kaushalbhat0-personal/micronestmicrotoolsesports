export interface UseCaseMeta {
  slug: string;
  title: string;
  description: string;
  audience: string[];
  category: string;
  publishedAt: string;
  primaryTool: string;
  related: {
    tool: string;
    guides: string[];
    glossary: string;
  };
}

export const USE_CASES: UseCaseMeta[] = [
  {
    slug: "esports-organizations",
    title: "For Esports Organizations: Keep Sponsorship Campaigns Auditable",
    description:
      "How esports organizations keep sponsor campaigns auditable — from campaign setup and creator channels to checks, proof and results.",
    audience: ["Esports organizations", "Esports teams", "Sponsorship managers"],
    category: "Sponsorship",
    publishedAt: "2026-10-12",
    primaryTool: "sponsorship-tracking",
    related: {
      tool: "sponsorship-tracking",
      guides: ["esports-sponsorship-deliverables", "proving-sponsored-content"],
      glossary: "proof-of-performance",
    },
  },
  {
    slug: "tournament-organizers",
    title: "Prize Pool Tools for Tournament Organizers",
    description:
      "How tournament organizers define a prize pool, choose a distribution model, validate percentages, calculate exact payouts, and communicate results — without handling registrations, brackets, payments or escrow.",
    audience: ["Tournament organizers", "Esports teams", "League operators"],
    category: "Prize Pool",
    publishedAt: "2026-10-17",
    primaryTool: "prize-pool-splitter",
    related: {
      tool: "prize-pool-splitter",
      guides: ["esports-prize-pool-distribution", "esports-prize-pool-percentage-split"],
      glossary: "prize-pool",
    },
  },
];

export function getUseCase(slug: string) {
  return USE_CASES.find((u) => u.slug === slug);
}
