import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plan } from "@/types/database";
import {
  buildPlanTeasers,
  getAllAccessEntry,
  getPaidProductEntries,
  isPaidMarketingSlug,
} from "./paid-products";

function plan(overrides: Partial<Plan> & { slug: string }): Plan {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    tool_id: null,
    name: overrides.slug,
    billing_period: "monthly",
    amount_minor: 79900,
    currency: "INR",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Plan;
}

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

describe("buildPlanTeasers — single-read derivation (P2-A)", () => {
  const prefixes = ["draft-ban", "tie-breaker"];

  it("maps monthly and yearly slugs to formatted INR teasers", () => {
    const teasers = buildPlanTeasers(
      [
        plan({ slug: "draft-ban-monthly", amount_minor: 79900, billing_period: "monthly" }),
        plan({ slug: "draft-ban-yearly", amount_minor: 799000, billing_period: "yearly" }),
      ],
      prefixes
    );
    expect(teasers.get("draft-ban")?.monthly).toContain("799");
    expect(teasers.get("draft-ban")?.yearly).toContain("7,990");
  });

  it("leaves missing plans null instead of fabricating prices", () => {
    const teasers = buildPlanTeasers([plan({ slug: "draft-ban-monthly" })], prefixes);
    expect(teasers.get("draft-ban")?.monthly).not.toBeNull();
    expect(teasers.get("draft-ban")?.yearly).toBeNull();
    expect(teasers.get("tie-breaker")).toEqual({ monthly: null, yearly: null });
  });

  it("ignores non-INR and inactive plans", () => {
    const teasers = buildPlanTeasers(
      [
        plan({ slug: "draft-ban-monthly", currency: "USD" }),
        plan({ slug: "tie-breaker-monthly", is_active: false }),
      ],
      prefixes
    );
    expect(teasers.get("draft-ban")).toEqual({ monthly: null, yearly: null });
    expect(teasers.get("tie-breaker")).toEqual({ monthly: null, yearly: null });
  });

  it("never produces a teaser for prefixes without plans (e.g. no roster-builder prefix exists)", () => {
    const teasers = buildPlanTeasers([plan({ slug: "draft-ban-monthly" })], ["tournament-roster-builder"]);
    expect(teasers.get("tournament-roster-builder")).toEqual({ monthly: null, yearly: null });
  });

  it("paid-tools page performs exactly one plan-list read per render (no per-card queries, no dead blocks)", () => {
    const source = readFileSync(join(process.cwd(), "src/app/paid-tools/page.tsx"), "utf8");
    expect(source.match(/listActivePlans\(/g)?.length).toBe(1);
    expect(source).not.toContain("monthlyTeaser");
    expect(source).not.toContain("offerCount");
    expect(source).not.toContain("void ");
    expect(source).not.toContain("buildOffers");
    expect(source).toContain("buildPlanTeasers");
    // Prices still server-derived and null-safe — never hardcoded.
    expect(source).not.toMatch(/₹\s?\d/);
    expect(source).toContain("/ year");
    expect(source).toContain("/ month");
  });
});
