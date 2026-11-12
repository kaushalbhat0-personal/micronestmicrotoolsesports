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
  "draft-ban": "draft-ban",
  "tie-breaker": "tie-breaker",
  "prize-payout-tracker": "prize-payout-tracker",
};

/**
 * Marketing slugs for released tools that are free with no paid plan
 * (RCCF-TOOLBOX-IA-02). These must never fall through to PreOrder /
 * coming-soon offer semantics — they are available now, just plan-less.
 * This set carries no billing meaning: no plan is created, no entitlement
 * is granted, and checkout is never involved.
 */
export const PLANLESS_FREE_TOOLS: ReadonlySet<string> = new Set(["tournament-roster-builder"]);

/** Offer shape for an available, plan-less free tool: no offers, in stock. */
export function buildFreeToolOffers(): {
  offers: null;
  availability: string;
} {
  return { offers: null, availability: "https://schema.org/InStock" };
}
