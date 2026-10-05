export function buildOffers(
  plans: Array<{ slug: string; name: string; billing_period: string; amount_minor: number; currency: string }> | null,
  status: "available" | "coming-soon"
): { offers: Record<string, unknown> | Array<Record<string, unknown>> | null; availability: string } {
  if (status === "coming-soon" || !plans || plans.length === 0) {
    return { offers: { "@type": "Offer", availability: "https://schema.org/PreOrder" }, availability: "https://schema.org/PreOrder" };
  }
  const offers = plans
    .filter((p) => p.currency === "INR")
    .map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: (p.amount_minor / 100).toString(),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      sku: p.slug,
      category: p.billing_period,
    }));
  return { offers, availability: "https://schema.org/InStock" };
}

export const TOOL_PLAN_PREFIX: Record<string, string> = {
  "sponsorship-tracking": "sponsorship-tracking",
  "prize-pool-splitter": "prize-pool-splitter",
};
