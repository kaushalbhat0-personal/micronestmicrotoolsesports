export interface GlossaryMeta {
  slug: string;
  term: string;
  title: string;
  description: string; // concise definition for AEO
  category: string;
  publishedAt: string;
  related: {
    tool: string;
    guides: string[];
    glossary?: string;
  };
}

export const GLOSSARY: GlossaryMeta[] = [
  {
    slug: "proof-of-performance",
    term: "Proof of Performance",
    title: "Proof of Performance in Esports Sponsorships",
    description:
      "Proof of performance is the evidence showing that a sponsored requirement was actually fulfilled — for example, that a creator published content containing a required sponsor element.",
    category: "Sponsorship",
    publishedAt: "2026-10-09",
    related: {
      tool: "sponsorship-tracking",
      guides: ["proving-sponsored-content", "esports-sponsorship-deliverables"],
      glossary: "sponsorship-deliverable",
    },
  },
  {
    slug: "sponsorship-deliverable",
    term: "Sponsorship Deliverable",
    title: "Sponsorship Deliverable: Definition & Examples",
    description:
      "A sponsorship deliverable is the specific output a sponsor pays for — such as a hashtag in a title, a link in a description, or a category during a campaign window.",
    category: "Sponsorship",
    publishedAt: "2026-10-09",
    related: {
      tool: "sponsorship-tracking",
      guides: ["esports-sponsorship-deliverables", "proving-sponsored-content"],
    },
  },
  {
    slug: "prize-pool",
    term: "Prize Pool",
    title: "Prize Pool in Esports: Definition & Examples",
    description:
      "A prize pool is the total prize money offered for an esports tournament — funded by the organizer, sponsors, or entry fees — before it is split into individual payouts.",
    category: "Prize Pool",
    publishedAt: "2026-10-14",
    related: {
      tool: "prize-pool-splitter",
      guides: ["esports-prize-pool-distribution", "esports-prize-pool-rounding"],
      glossary: "prize-pool-distribution",
    },
  },
  {
    slug: "prize-pool-distribution",
    term: "Prize Pool Distribution",
    title: "Prize Pool Distribution: How Tournament Payouts Are Split",
    description:
      "Prize pool distribution is how a total prize pool is divided into individual payouts — distinct from pool size, payout structure, or any single prize amount.",
    category: "Prize Pool",
    publishedAt: "2026-10-15",
    related: {
      tool: "prize-pool-splitter",
      guides: ["esports-prize-pool-distribution", "esports-prize-pool-percentage-split"],
      glossary: "prize-pool",
    },
  },
];

export function getGlossary(slug: string) {
  return GLOSSARY.find((g) => g.slug === slug);
}
