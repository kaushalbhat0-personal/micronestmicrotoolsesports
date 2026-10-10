import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getToolFreePolicy } from "@/config/tools/policy";
import { FREE_TIERS, freeTierByMarketingSlug, freeTierBySlug } from "@/config/marketing/free-tiers";
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
  it("covers all four available tools with Free forever badges", () => {
    expect(FREE_TIERS).toHaveLength(4);
    for (const tier of FREE_TIERS) {
      expect(tier.badge).toBe("Free forever");
      expect(tier.allowance.length).toBeGreaterThan(0);
      expect(tier.details.length).toBeGreaterThan(0);
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

  it("resolves by both internal and marketing slugs (prize differs)", () => {
    expect(freeTierByMarketingSlug("prize-pool-splitter")?.slug).toBe("prize-splitter");
    expect(freeTierByMarketingSlug("draft-ban")?.slug).toBe("draft-ban");
    expect(freeTierBySlug("nope")).toBeNull();
    expect(freeTierByMarketingSlug("scrim-matchmaker")).toBeNull();
  });
});

describe("homepage exposes Free discovery", () => {
  it("renders a Free section with all four tiers and an Explore free tools CTA", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("Every MicroNest tool has a Free tier");
    expect(code).toContain("Start free. Upgrade when you need more.");
    expect(code).toContain("Explore free tools");
    expect(code).toContain('href="/tools"');
    expect(code).toContain("FREE_TIERS");
    expect(code).toContain("No credit card required");
  });

  it("marks featured and organizer cards with compact Free lines", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("Free forever");
    expect(code).toContain("freeTierBySlug");
  });

  it("keeps SEO metadata (titles intact, descriptions mention free naturally)", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("Sponsorship Tracking for Esports Creators & Teams | MicroNest");
    expect(code).toContain("can be started free");
    expect(code).toContain('canonical: "/"');
  });
});

describe("tool catalog exposes Free per available tool", () => {
  it("badges available tools Free forever with the allowance line", () => {
    const code = sourceOf(TOOLS_PAGE);
    expect(code).toContain("Free forever");
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
  it("shows Free status, allowance details, and a Start free CTA", () => {
    const code = sourceOf(TOOL_PAGE);
    expect(code).toContain("Free forever");
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
  it("renders the Free forever section with all four allowances", () => {
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
