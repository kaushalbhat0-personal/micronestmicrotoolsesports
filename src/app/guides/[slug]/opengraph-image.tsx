import { createOgImage } from "@/lib/marketing/og";
import { getGuide, GUIDES } from "@/config/content/guides";

export const alt = "MicroNest guide share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return createOgImage({ eyebrow: "Guide", title: "Guide not found", motif: "MicroNest" });
  }
  const accent = guide.category === "Prize Pool" ? "charcoal" : "terracotta";
  return createOgImage({
    eyebrow: `Guide · ${guide.category}`,
    title: guide.title,
    description: guide.description.slice(0, 140),
    motif: guide.primaryTool === "prize-pool-splitter" ? "50 / 30 / 20" : "#Sponsor · Proof",
    accent,
  });
}
