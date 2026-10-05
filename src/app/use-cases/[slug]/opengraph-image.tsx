import { createOgImage } from "@/lib/marketing/og";
import { getUseCase, USE_CASES } from "@/config/content/use-cases";

export const alt = "MicroNest use case share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getUseCase(slug);
  if (!entry) {
    return createOgImage({ eyebrow: "Use case", title: "Use case not found" });
  }
  const isPrize = entry.slug === "tournament-organizers";
  return createOgImage({
    eyebrow: `Use case · ${isPrize ? "Prize Pool" : "Organizations"}`,
    title: entry.title,
    description: entry.description.slice(0, 140),
    motif: isPrize ? "50 / 30 / 20" : "#Sponsor · Proof",
    accent: isPrize ? "charcoal" : "teal",
  });
}
