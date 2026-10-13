import { describe, expect, it } from "vitest";
import { toCatalogTools } from "./catalog-tools";
import type { BillingAvailableCard, BillingToolCard } from "@/server/services/billing-service";

const FREE = (badge: "Free forever" | "Free plan", allowance: string) => ({ badge, allowance, details: allowance });

function owned(toolSlug: string): BillingToolCard {
  return {
    toolSlug,
    displayName: `${toolSlug} owned`,
    description: "owned",
    icon: "Split",
    status: "permanent",
    expiresAt: null,
    viaAllAccess: false,
    viaUserGrant: false,
    accessKind: "free",
    hasPaidPlans: false,
    free: FREE("Free forever", "Unlimited"),
  };
}

function addable(toolSlug: string): BillingAvailableCard {
  return {
    toolSlug,
    displayName: `${toolSlug} addable`,
    description: "addable",
    icon: "Split",
    monthly: null,
    yearly: null,
    free: FREE("Free plan", "1/month"),
    claimable: true,
  };
}

describe("toCatalogTools (RCCF F3/F4)", () => {
  it("lists all six released tools in registry order", () => {
    const tools = toCatalogTools([], ["prize-splitter", "roster-builder", "draft-ban", "tie-breaker", "payout-tracker", "sponsor-sentinel"].map(addable));
    expect(tools.map((t) => t.toolSlug)).toEqual([
      "sponsor-sentinel",
      "prize-splitter",
      "draft-ban",
      "tie-breaker",
      "payout-tracker",
      "roster-builder",
    ]);
  });

  it("marks entitled tools openable and claimable tools startable with canonical Free copy", () => {
    const tools = toCatalogTools([owned("prize-splitter")], [addable("tie-breaker")]);
    const splitter = tools.find((t) => t.toolSlug === "prize-splitter");
    const tie = tools.find((t) => t.toolSlug === "tie-breaker");
    expect(splitter).toMatchObject({ entitled: true, freeBadge: "Free forever", freeAllowance: "Free: Unlimited" });
    expect(tie).toMatchObject({ entitled: false, claimable: true, freeBadge: "Free plan", freeAllowance: "Free: 1/month" });
  });

  it("falls back to registry metadata when Billing has no row (fail open for discovery)", () => {
    const tools = toCatalogTools([], []);
    expect(tools).toHaveLength(6);
    expect(tools.every((t) => t.entitled === false && t.claimable === false)).toBe(true);
    expect(tools.find((t) => t.toolSlug === "draft-ban")?.displayName).toBe("Draft & Ban");
  });
});
