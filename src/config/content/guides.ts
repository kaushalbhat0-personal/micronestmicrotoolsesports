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
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
