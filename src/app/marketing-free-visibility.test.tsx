import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getToolFreePolicy } from "@/config/tools/policy";
import { FREE_TIERS, freeBadgeByMarketingSlug, freeBadgeBySlug, freeTierByMarketingSlug, freeTierBySlug } from "@/config/marketing/free-tiers";
import { MARKETING_TOOLS, getAvailableTools, getMarketingTool } from "@/config/marketing/tools";
import { PricingClient } from "@/app/pricing/pricing-client";
import type { Plan } from "@/types/database";

/**
 * Free-visibility marketing tests.
 *
 * Proves public acquisition surfaces communicate the approved Free tiers
 * accurately: copy derives from the authoritative policy registry (single
 * source), Free CTAs never route into paid-plan checkout, coming-soon tools
 * gain no Free claims, and pricing/All Access/SEO foundations are unchanged.
 * Page-level assertions read sources (server components fetch at render, so
 * static assertions follow the repo's share-public precedent); the client
 * PricingClient is rendered for real.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const HOMEPAGE = "src/app/page.tsx";
const TOOLS_PAGE = "src/app/tools/page.tsx";
const TOOL_PAGE = "src/app/tools/[slug]/page.tsx";
const PRICING_CLIENT = "src/app/pricing/pricing-client.tsx";

describe("free-tier content is registry-derived (single source)", () => {
  it("covers all six available tools with canonical Free badges", () => {
    expect(FREE_TIERS).toHaveLength(6);
    for (const tier of FREE_TIERS) {
      expect(tier.badge).toBe(freeBadgeBySlug(tier.slug));
      expect(tier.allowance.length).toBeGreaterThan(0);
      expect(tier.details.length).toBeGreaterThan(0);
    }
    // Canonical semantics: unlimited → Free forever, quota-limited → Free plan.
    expect(freeTierBySlug("prize-splitter")?.badge).toBe("Free forever");
    expect(freeTierBySlug("roster-builder")?.badge).toBe("Free forever");
    for (const slug of ["sponsor-sentinel", "tie-breaker", "draft-ban", "payout-tracker"]) {
      expect(freeTierBySlug(slug)?.badge).toBe("Free plan");
    }
  });

  it("sponsorship numbers match the policy registry", () => {
    const limits = getToolFreePolicy("sponsor-sentinel")?.limits;
    const tier = freeTierBySlug("sponsor-sentinel");
    expect(tier?.allowance).toContain(String(limits?.activeCampaigns ?? 1));
    expect(tier?.allowance).toContain(String(limits?.connectedChannels ?? 1));
    expect(tier?.allowance).toContain(`${limits?.monthlyChecks ?? 10} checks/month`);
  });

  it("prize states unlimited (registry exposes no limits by design)", () => {
    expect(getToolFreePolicy("prize-splitter")?.limits).toEqual({});
    const tier = freeTierBySlug("prize-splitter");
    expect(tier?.allowance).toMatch(/Unlimited/i);
    expect(tier?.details).toMatch(/Unlimited/i);
  });

  it("tie-breaker states 3 official results/month from the registry", () => {
    const locks = getToolFreePolicy("tie-breaker")?.limits.lockedOfficialRecordsPerMonth;
    expect(freeTierBySlug("tie-breaker")?.allowance).toBe(`${locks} official results/month`);
    expect(locks).toBe(3);
  });

  it("draft-ban states 1 completed match/month from the registry", () => {
    const matches = getToolFreePolicy("draft-ban")?.limits.completedMatchesPerMonth;
    expect(freeTierBySlug("draft-ban")?.allowance).toBe(`${matches} completed match/month`);
    expect(matches).toBe(1);
  });

  it("payout-tracker states 1 published tracker/month from the registry", () => {
    const publishes = getToolFreePolicy("payout-tracker")?.limits.publishedTrackersPerMonth;
    expect(freeTierBySlug("payout-tracker")?.allowance).toBe(`${publishes} published tracker/month`);
    expect(publishes).toBe(1);
    expect(freeTierByMarketingSlug("prize-payout-tracker")?.slug).toBe("payout-tracker");
  });

  it("resolves by both internal and marketing slugs (prize differs)", () => {
    expect(freeTierByMarketingSlug("prize-pool-splitter")?.slug).toBe("prize-splitter");
    expect(freeTierByMarketingSlug("draft-ban")?.slug).toBe("draft-ban");
    expect(freeTierByMarketingSlug("tournament-roster-builder")?.slug).toBe("roster-builder");
    expect(freeTierBySlug("nope")).toBeNull();
    expect(freeTierByMarketingSlug("scrim-matchmaker")).toBeNull();
  });

  it("roster-builder states unlimited (registry exposes no limits by design)", () => {
    expect(getToolFreePolicy("roster-builder")?.limits).toEqual({});
    const tier = freeTierBySlug("roster-builder");
    expect(tier?.allowance).toMatch(/Unlimited/i);
    expect(tier?.details).toMatch(/Unlimited/i);
  });
});

describe("catalog badges follow the canonical Free policy (data-driven)", () => {
  const EXPECTED: ReadonlyArray<{ slug: string; marketingSlug: string; badge: "Free forever" | "Free plan" }> = [
    { slug: "sponsor-sentinel", marketingSlug: "sponsorship-tracking", badge: "Free plan" },
    { slug: "prize-splitter", marketingSlug: "prize-pool-splitter", badge: "Free forever" },
    { slug: "tie-breaker", marketingSlug: "tie-breaker", badge: "Free plan" },
    { slug: "draft-ban", marketingSlug: "draft-ban", badge: "Free plan" },
    { slug: "payout-tracker", marketingSlug: "prize-payout-tracker", badge: "Free plan" },
    { slug: "roster-builder", marketingSlug: "tournament-roster-builder", badge: "Free forever" },
  ];

  it("maps every catalog-visible tool to its canonical badge", () => {
    expect(EXPECTED).toHaveLength(FREE_TIERS.length);
    for (const { slug, marketingSlug, badge } of EXPECTED) {
      expect(freeBadgeBySlug(slug)).toBe(badge);
      expect(freeBadgeByMarketingSlug(marketingSlug)).toBe(badge);
    }
  });

  it("quota-limited tools can never regress to Free forever", () => {
    for (const slug of ["sponsor-sentinel", "tie-breaker", "draft-ban", "payout-tracker"]) {
      expect(Object.keys(getToolFreePolicy(slug)?.limits ?? {})).not.toHaveLength(0);
      expect(freeBadgeBySlug(slug)).toBe("Free plan");
    }
  });

  it("unlimited tools keep Free forever", () => {
    for (const slug of ["prize-splitter", "roster-builder"]) {
      expect(getToolFreePolicy(slug)?.limits).toEqual({});
      expect(freeBadgeBySlug(slug)).toBe("Free forever");
    }
  });

  it("unknown and removed slugs resolve to null (fail closed, never invented)", () => {
    for (const slug of ["nope", "scrim-matchmaker", "vod-clipper", "roster-sentinel", "all-access"]) {
      expect(freeBadgeBySlug(slug)).toBeNull();
      expect(freeBadgeByMarketingSlug(slug)).toBeNull();
    }
  });
});

describe("homepage exposes Free discovery", () => {
  it("renders a Free section with all six tiers and an Explore free tools CTA", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("Every MicroNest tool has a Free tier");
    expect(code).toContain("Start free. Upgrade when you need more.");
    expect(code).toContain("Explore free tools");
    expect(code).toContain('href="/tools"');
    expect(code).toContain("FREE_TIERS");
    expect(code).toContain("No credit card required");
  });

  it("marks featured and toolbox cards with canonical Free badges", () => {
    const code = sourceOf(HOMEPAGE);
    // Badges derive from the canonical policy chain — no hardcoded wording.
    expect(code).toContain("freeBadgeBySlug");
    expect(code).toContain("freeTierBySlug");
    expect(code).not.toMatch(/>Free forever</);
  });

  it("keeps SEO metadata (titles intact, descriptions mention free naturally)", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("Sponsorship Tracking for Esports Creators & Teams | MicroNest");
    expect(code).toContain("can be started free");
    expect(code).toContain('canonical: "/"');
  });
});

describe("homepage toolbox discovery (canonical, no hardcoded subset)", () => {
  it("derives every released tool from the canonical registry", () => {
    const available = getAvailableTools();
    expect(available).toHaveLength(6);
    expect(available.map((t) => t.slug).sort()).toEqual(MARKETING_TOOLS.map((t) => t.slug).sort());
    for (const tool of available) {
      // Every card links to a real public route backed by the same registry.
      expect(getMarketingTool(tool.slug)?.slug).toBe(tool.slug);
      expect(tool.internalSlug).toBeTruthy();
      // Every card carries a canonical Free badge — never invented per card.
      const tier = freeTierBySlug(tool.internalSlug!);
      expect(tier).not.toBeNull();
      expect(freeBadgeBySlug(tool.internalSlug!)).not.toBeNull();
      expect(freeBadgeByMarketingSlug(tool.slug)).toBe(freeBadgeBySlug(tool.internalSlug!));
    }
  });

  it("never surfaces removed tools", () => {
    const slugs = new Set([...MARKETING_TOOLS.map((t) => t.slug), ...MARKETING_TOOLS.map((t) => t.internalSlug)]);
    for (const slug of ["scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(slugs.has(slug)).toBe(false);
      expect(getMarketingTool(slug)).toBeUndefined();
    }
    for (const name of ["Scrim Matchmaker", "VOD Clipper", "Roster Sentinel"]) {
      expect(sourceOf(HOMEPAGE)).not.toContain(name);
    }
  });

  it("marks exactly the anonymous-demo tools for Try-it-now treatment", () => {
    const demo = getAvailableTools().filter((t) => t.hasPublicDemo).map((t) => t.slug).sort();
    expect(demo).toEqual(["prize-pool-splitter", "tournament-roster-builder"]);
  });

  it("renders the toolbox section from canonical data (no hardcoded tool subset)", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("getAvailableTools");
    expect(code).not.toContain("ORGANIZER_TOOL_SLUGS");
    expect(code).toContain("One toolbox for every esports job");
    expect(code).toContain("Try it now");
    expect(code).toContain("View all tools");
    expect(code).toContain("hasPublicDemo");
  });

  it("links Free-tier names to their public tool pages", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("tier.marketingSlug");
    for (const tier of FREE_TIERS) {
      expect(getMarketingTool(tier.marketingSlug)?.slug).toBeTruthy();
    }
  });

  it("keeps every existing homepage section intact", () => {
    const code = sourceOf(HOMEPAGE);
    for (const marker of [
      "Featured • Available now",
      "Reporting sponsors shouldn&apos;t take all week",
      "Who it is for",
      "Start free. Upgrade when you need more.",
      "Every MicroNest tool has a Free tier",
      "Explore free tools",
      "Supported platforms",
      "Start with Sponsorship Tracking",
      "Prove it. Send it. Get renewed.",
      "Built in Pune",
    ]) {
      expect(code).toContain(marker);
    }
  });
});

describe("tool catalog exposes Free per available tool", () => {
  it("badges available tools with the canonical Free badge plus allowance line", () => {
    const code = sourceOf(TOOLS_PAGE);
    // No hardcoded badge: quota-limited tools must never read "Free forever".
    expect(code).not.toContain("Free forever");
    expect(code).toContain("freeBadgeByMarketingSlug");
    expect(code).toContain("freeTierByMarketingSlug");
    expect(code).toContain("Free: {free.allowance}");
    expect(code).toContain("Every available tool can be started free");
  });

  it("coming-soon tools gain no Free claim and stay non-purchasable", () => {
    const code = sourceOf(TOOLS_PAGE);
    // Free lookup is gated on availability; coming-soon keeps its own treatment.
    expect(code).toContain("const free = isAvailable ? freeTierByMarketingSlug(tool.slug) : null;");
    expect(code).toContain("Coming soon");
    expect(code).toContain("Preview concept");
    expect(code).not.toMatch(/coming.?soon[\s\S]{0,200}Start free/i);
  });
});

describe("individual tool pages expose Free with correct hierarchy", () => {
  it("shows canonical Free status, allowance details, and a Start free CTA", () => {
    const code = sourceOf(TOOL_PAGE);
    expect(code).not.toContain(">Free forever<");
    expect(code).toContain("freeBadgeByMarketingSlug");
    expect(code).toContain("freeTierByMarketingSlug");
    expect(code).toContain("No credit card required");
    expect(code).toContain("Free never expires");
    expect(code).toContain("Start free");
    expect(code).toContain("View pricing");
  });

  it("no Free CTA routes into paid-plan checkout", () => {
    const code = sourceOf(TOOL_PAGE);
    // The only plan-parameterized signup link is the retained paid CTA.
    const planLinks = [...code.matchAll(/signup\?plan=/g)];
    expect(planLinks.length).toBe(1);
    expect(code).toContain('href="/signup"');
    // Both "Start free" CTAs (Free section + available card) use the plan-free route.
    const freeCtas = [...code.matchAll(/href="\/signup" aria-label=\{`Start using/g)];
    expect(freeCtas.length).toBe(2);
  });

  it("keeps the paid path visible (monthly price + Get CTA retained)", () => {
    const code = sourceOf(TOOL_PAGE);
    expect(code).toContain("Get {tool.name}");
    expect(code).toContain("monthlyPrice");
    expect(code).toContain("See all plans");
  });

  it("coming-soon tools show no Free section", () => {
    const code = sourceOf(TOOL_PAGE);
    expect(code).toContain("const free = tool.status === \"available\" ? freeTierByMarketingSlug(tool.slug) : null;");
  });
});

describe("pricing exposes Free as a deliberate tier", () => {
  it("renders the Free forever section with all six allowances", () => {
    const code = sourceOf(PRICING_CLIENT);
    expect(code).toContain("Free forever plans");
    expect(code).toContain("₹0 forever");
    expect(code).toContain("no credit card");
    expect(code).toContain("never expires");
    expect(code).toContain("FREE_TIERS");
    expect(code).toContain("Free: {tier.allowance}");
  });

  it("Free CTA routes plan-free, never into paid checkout", () => {
    const code = sourceOf(PRICING_CLIENT);
    expect(code).toContain('href="/signup"');
    // Only the paid plan cards carry plan-parameterized signup links.
    const planLinks = [...code.matchAll(/\/signup\?plan=/g)];
    expect(planLinks.length).toBe(1);
  });

  it("keeps All Access, savings, and plan-card pricing logic unchanged", () => {
    const code = sourceOf(PRICING_CLIENT);
    expect(code).toContain("Includes all currently available paid esports tools");
    expect(code).toContain("covers only the tools available at the time of purchase");
    expect(code).toContain("savingsLabel");
    expect(code).toContain("CARD_META");
  });

  it("renders for real with mock catalog plans", () => {
    const plans = [
      { slug: "prize-pool-splitter-monthly", name: "Prize", amount_minor: 69900, currency: "INR", billing_period: "monthly", is_active: true },
      { slug: "prize-pool-splitter-yearly", name: "Prize", amount_minor: 699000, currency: "INR", billing_period: "yearly", is_active: true },
    ] as unknown as Plan[];
    const html = renderToString(<PricingClient plans={plans} />);
    expect(html).toContain("Free forever");
    expect(html).toContain("Unlimited calculations");
    expect(html).toContain("Start free");
    expect(html).toContain("Prize Pool Splitter");
  });
});
