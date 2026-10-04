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
];

export function getUseCase(slug: string) {
  return USE_CASES.find((u) => u.slug === slug);
}
