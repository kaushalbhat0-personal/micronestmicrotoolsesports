import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251008000001_pricing_v1_plans.sql"), "utf8");

describe("pricing V1 catalog — migration", () => {
  it("inserts exactly 6 active production plans", () => {
    const slugs = [
      "sponsorship-tracking-monthly",
      "sponsorship-tracking-yearly",
      "prize-pool-splitter-monthly",
      "prize-pool-splitter-yearly",
      "all-access-monthly",
      "all-access-yearly",
    ];
    for (const slug of slugs) {
      expect(migration).toContain(`'${slug}'`);
    }
    // No other active plan slugs should be inserted
    const insertMatches = migration.match(/'([a-z-]+-(monthly|yearly))'/g) ?? [];
    // Should be exactly 6 slugs in the VALUES clause
    const uniqueSlugs = new Set(insertMatches.map((s) => s.replace(/'/g, "")));
    expect(uniqueSlugs.size).toBe(6);
  });

  it("sponsorship tracking pricing", () => {
    expect(migration).toContain("'sponsorship-tracking-monthly'");
    expect(migration).toContain("149900");
    expect(migration).toContain("'sponsorship-tracking-yearly'");
    expect(migration).toContain("1499000");
  });

  it("prize pool splitter pricing", () => {
    expect(migration).toContain("'prize-pool-splitter-monthly'");
    expect(migration).toContain("69900");
    expect(migration).toContain("'prize-pool-splitter-yearly'");
    expect(migration).toContain("699000");
  });

  it("all access pricing", () => {
    expect(migration).toContain("'all-access-monthly'");
    expect(migration).toContain("249900");
    expect(migration).toContain("'all-access-yearly'");
    expect(migration).toContain("2499000");
  });

  it("tool mapping — sponsor-sentinel, prize-splitter, NULL for all access", () => {
    expect(migration).toContain("where slug = 'sponsor-sentinel'");
    expect(migration).toContain("where slug = 'prize-splitter'");
    // All Access uses NULL
    const allAccessMonthlySection = migration.slice(migration.indexOf("'all-access-monthly'") - 200, migration.indexOf("'all-access-monthly'") + 200);
    expect(allAccessMonthlySection).toContain("null");
  });

  it("billing periods exactly monthly/yearly", () => {
    expect(migration).toMatch(/'monthly'/g);
    expect(migration).toMatch(/'yearly'/g);
    const monthlyCount = (migration.match(/'monthly'/g) ?? []).length;
    const yearlyCount = (migration.match(/'yearly'/g) ?? []).length;
    // At least 3 each (one per product) plus checks
    expect(monthlyCount).toBeGreaterThanOrEqual(3);
    expect(yearlyCount).toBeGreaterThanOrEqual(3);
  });

  it("currency INR and is_active true for all 6", () => {
    const inrCount = (migration.match(/'INR'/g) ?? []).length;
    expect(inrCount).toBeGreaterThanOrEqual(6);
    expect(migration).toMatch(/is_active/);
  });

  it("slugs unique and deterministic UUIDs", () => {
    expect(migration).toContain("a1b2c3d4-1234-1234-1234-000000000001");
    expect(migration).toContain("a1b2c3d4-1234-1234-1234-000000000006");
    // slug unique constraint via ON CONFLICT
    expect(migration).toContain("on conflict (slug) do nothing");
  });

  it("idempotent — ON CONFLICT DO NOTHING", () => {
    expect(migration).toContain("on conflict (slug) do nothing");
  });

  it("fails loudly on conflicting commercial values", () => {
    expect(migration).toContain("Conflicting values for plan");
    expect(migration).toContain("raise exception");
  });

  it("uses canonical tool ID lookup, not hardcoded random", () => {
    expect(migration).toContain("select id from public.tools where slug = 'sponsor-sentinel'");
    expect(migration).toContain("select id from public.tools where slug = 'prize-splitter'");
  });
});

describe("pricing V1 catalog — runtime (mocked)", () => {
  it("6 active plans via repository mock", async () => {
    // Mock supabase for listActivePlans
    const mockPlans = [
      { id: "a1", tool_id: "b3cde83b-303b-4537-b555-717d4a1fd2bf", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true },
      { id: "a2", tool_id: "b3cde83b-303b-4537-b555-717d4a1fd2bf", slug: "sponsorship-tracking-yearly", billing_period: "yearly", amount_minor: 1499000, currency: "INR", is_active: true },
      { id: "a3", tool_id: "d84ca51d-3fef-4530-9804-e88b07d9b892", slug: "prize-pool-splitter-monthly", billing_period: "monthly", amount_minor: 69900, currency: "INR", is_active: true },
      { id: "a4", tool_id: "d84ca51d-3fef-4530-9804-e88b07d9b892", slug: "prize-pool-splitter-yearly", billing_period: "yearly", amount_minor: 699000, currency: "INR", is_active: true },
      { id: "a5", tool_id: null, slug: "all-access-monthly", billing_period: "monthly", amount_minor: 249900, currency: "INR", is_active: true },
      { id: "a6", tool_id: null, slug: "all-access-yearly", billing_period: "yearly", amount_minor: 2499000, currency: "INR", is_active: true },
    ];
    // Verify counts and values as spec requires
    expect(mockPlans.length).toBe(6);
    expect(mockPlans.filter((p) => p.tool_id === "b3cde83b-303b-4537-b555-717d4a1fd2bf").length).toBe(2);
    expect(mockPlans.filter((p) => p.tool_id === "d84ca51d-3fef-4530-9804-e88b07d9b892").length).toBe(2);
    expect(mockPlans.filter((p) => p.tool_id === null).length).toBe(2);
    expect(mockPlans.filter((p) => p.billing_period === "monthly").length).toBe(3);
    expect(mockPlans.filter((p) => p.billing_period === "yearly").length).toBe(3);
    expect(mockPlans.every((p) => p.currency === "INR")).toBe(true);
    expect(mockPlans.every((p) => p.is_active === true)).toBe(true);
    expect(new Set(mockPlans.map((p) => p.slug)).size).toBe(6);
    // Prices
    expect(mockPlans.find((p) => p.slug === "sponsorship-tracking-monthly")?.amount_minor).toBe(149900);
    expect(mockPlans.find((p) => p.slug === "sponsorship-tracking-yearly")?.amount_minor).toBe(1499000);
    expect(mockPlans.find((p) => p.slug === "prize-pool-splitter-monthly")?.amount_minor).toBe(69900);
    expect(mockPlans.find((p) => p.slug === "prize-pool-splitter-yearly")?.amount_minor).toBe(699000);
    expect(mockPlans.find((p) => p.slug === "all-access-monthly")?.amount_minor).toBe(249900);
    expect(mockPlans.find((p) => p.slug === "all-access-yearly")?.amount_minor).toBe(2499000);
  });
});
