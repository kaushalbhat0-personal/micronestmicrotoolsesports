import { describe, expect, it } from "vitest";
import { getAllAccessEntry, getPaidProductEntries, isPaidMarketingSlug } from "./paid-products";

describe("paid-products — single presentation source", () => {
  it("derives exactly the five paid tools from TOOL_PLAN_PREFIX", () => {
    const slugs = getPaidProductEntries().map((e) => e.marketingSlug).sort();
    expect(slugs).toEqual(
      ["draft-ban", "prize-payout-tracker", "prize-pool-splitter", "sponsorship-tracking", "tie-breaker"].sort()
    );
  });

  it("excludes Roster Builder from paid products", () => {
    expect(isPaidMarketingSlug("tournament-roster-builder")).toBe(false);
    expect(getPaidProductEntries().some((e) => e.marketingSlug === "tournament-roster-builder")).toBe(false);
  });

  it("represents All Access via existing coverage (no new list, no prices)", () => {
    const all = getAllAccessEntry();
    expect(all.name).toBe("All Access");
    expect(all.coveredMarketingSlugs).toHaveLength(5);
    expect(JSON.stringify(all)).not.toMatch(/₹|\d{3,}/);
  });
});
