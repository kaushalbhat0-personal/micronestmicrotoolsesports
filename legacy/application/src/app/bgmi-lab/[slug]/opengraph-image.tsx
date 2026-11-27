import { createOgImage } from "@/lib/marketing/og";
import { getLabTool, getRoutableLabTools } from "@/lib/marketing/public-tool-content";

export const alt = "MicroNest BGMI Lab share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return getRoutableLabTools().map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getLabTool(slug);
  if (!tool) {
    return createOgImage({
      eyebrow: "MicroNest · BGMI Lab",
      title: "Drill not found",
      description: "Free BGMI practice drills. No signup.",
      motif: "BGMI LAB",
      accent: "terracotta",
    });
  }
  return createOgImage({
    eyebrow: `BGMI Lab · ${tool.name}`,
    title: tool.name,
    description: tool.tagline,
    motif: tool.ogMotif ?? "Free drill · No signup",
    accent: "terracotta",
  });
}
