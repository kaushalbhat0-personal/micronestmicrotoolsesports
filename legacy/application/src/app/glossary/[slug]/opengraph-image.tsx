import { createOgImage } from "@/lib/marketing/og";
import { getGlossary, GLOSSARY } from "@/config/content/glossary";

export const alt = "MicroNest glossary share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return GLOSSARY.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getGlossary(slug);
  if (!entry) {
    return createOgImage({ eyebrow: "Glossary", title: "Term not found" });
  }
  return createOgImage({
    eyebrow: `Glossary · ${entry.category}`,
    title: entry.term,
    description: entry.description.slice(0, 140),
    motif: entry.term.includes("Prize") ? "50 / 30 / 20" : "Proof · Deliverable",
    accent: "charcoal",
  });
}
