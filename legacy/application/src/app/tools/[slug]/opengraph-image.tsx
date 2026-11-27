import { createOgImage } from "@/lib/marketing/og";
import { getMarketingTool, MARKETING_TOOLS } from "@/config/marketing/tools";

export const alt = "MicroNest tool share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return MARKETING_TOOLS.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getMarketingTool(slug);
  if (!tool) {
    return createOgImage({
      eyebrow: "MicroNest",
      title: "Tool not found",
      description: "The toolbox behind esports.",
      motif: "T01 · MicroNest",
      accent: "terracotta",
    });
  }
  return createOgImage({
    eyebrow: `${tool.number} · ${tool.name}`,
    title: tool.name,
    description: tool.shortDescription,
    motif: tool.motif,
    accent: tool.accent,
  });
}
