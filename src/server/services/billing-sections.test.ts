import { describe, expect, it } from "vitest";
import type { Plan } from "@/types/database";
import { buildBillingToolSections } from "./billing-service";

const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

type PlanFixture = Pick<Plan, "id" | "tool_id" | "billing_period" | "amount_minor" | "currency" | "is_active">;

const TOOLS_ROWS = [
  { id: "tool-sponsor", slug: "sponsor-sentinel", is_active: true },
  { id: "tool-prize", slug: "prize-splitter", is_active: true },
  { id: "tool-draft", slug: "draft-ban", is_active: true },
  { id: "tool-tie", slug: "tie-breaker", is_active: true },
];

const PLANS: PlanFixture[] = [
  { id: "p-s-m", tool_id: "tool-sponsor", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true },
  { id: "p-s-y", tool_id: "tool-sponsor", billing_period: "yearly", amount_minor: 1499000, currency: "INR", is_active: true },
  { id: "p-p-m", tool_id: "tool-prize", billing_period: "monthly", amount_minor: 69900, currency: "INR", is_active: true },
  { id: "p-d-m", tool_id: "tool-draft", billing_period: "monthly", amount_minor: 9900, currency: "INR", is_active: true },
  { id: "p-d-y", tool_id: "tool-draft", billing_period: "yearly", amount_minor: 99000, currency: "INR", is_active: true },
  { id: "p-aa-m", tool_id: null, billing_period: "monthly", amount_minor: 249900, currency: "INR", is_active: true },
];

function ent(toolSlug: string | null, status: "permanent" | "active" | "expiring_soon" | "expired", expiresAt: string | null, isAllAccess = false) {
  return { toolSlug, toolName: toolSlug ?? "All Access", isAllAccess, source: "subscription", expiresAt, status };
}

describe("buildBillingToolSections", () => {
  it("1. entitled commercial tool appears in Your Tools", () => {
    const { yourTools } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "permanent", null)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(yourTools.map((t) => t.toolSlug)).toContain("sponsor-sentinel");
  });

  it("2+3. unentitled commercial tool (Draft & Ban) appears in Available to Add, never hardcoded", () => {
    const { yourTools, availableToAdd } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "permanent", null)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(yourTools.some((t) => t.toolSlug === "draft-ban")).toBe(false);
    const draft = availableToAdd.find((t) => t.toolSlug === "draft-ban");
    expect(draft).toBeDefined();
    expect(draft!.monthly).toMatchObject({ planId: "p-d-m", amountMinor: 9900 });
    expect(draft!.yearly).toMatchObject({ planId: "p-d-y", amountMinor: 99000 });
  });

  it("4. entitled tool does not duplicate in Available to Add", () => {
    const { availableToAdd } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "permanent", null)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(availableToAdd.some((t) => t.toolSlug === "sponsor-sentinel")).toBe(false);
  });

  it("5. coming-soon tools never appear as purchasable", () => {
    const { yourTools, availableToAdd } = buildBillingToolSections({ entitlements: [], plans: PLANS, tools: TOOLS_ROWS });
    const slugs = [...yourTools, ...availableToAdd].map((t) => t.toolSlug);
    for (const soon of ["scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(slugs).not.toContain(soon);
    }
  });

  it("6+7. permanent and finite expiries pass through authoritatively", () => {
    const { yourTools } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "permanent", null), ent("prize-splitter", "active", FUTURE)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(yourTools.find((t) => t.toolSlug === "sponsor-sentinel")!.expiresAt).toBeNull();
    expect(yourTools.find((t) => t.toolSlug === "prize-splitter")!.expiresAt).toBe(FUTURE);
  });

  it("8. expired entitlement excluded from Your Tools", () => {
    const { yourTools } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "expired", PAST)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(yourTools).toHaveLength(0);
  });

  it("9+10+11. All Access expands to covered tools marked via All Access, no fake card", () => {
    const { yourTools, availableToAdd } = buildBillingToolSections({
      entitlements: [ent(null, "active", FUTURE, true)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    expect(yourTools.length).toBeGreaterThan(0);
    for (const t of yourTools) {
      expect(t.viaAllAccess).toBe(true);
      expect(t.expiresAt).toBe(FUTURE);
    }
    expect(yourTools.some((t) => t.toolSlug === "all-access")).toBe(false);
    expect(availableToAdd).toHaveLength(0);
  });

  it("21. user sponsorship grants never surface (org rows only in, nothing out)", () => {
    const { yourTools } = buildBillingToolSections({
      entitlements: [ent("sponsor-sentinel", "permanent", null)],
      plans: PLANS,
      tools: TOOLS_ROWS,
    });
    const json = JSON.stringify(yourTools);
    expect(json).not.toMatch(/user_id|grant|organization_id|tool_id/);
  });

  it("supports future tools automatically (plans-driven, no hardcoding)", () => {
    const { availableToAdd } = buildBillingToolSections({
      entitlements: [],
      plans: [...PLANS, { id: "p-t-m", tool_id: "tool-tie", billing_period: "monthly", amount_minor: 7900, currency: "INR", is_active: true }],
      tools: TOOLS_ROWS,
    });
    const tie = availableToAdd.find((t) => t.toolSlug === "tie-breaker");
    expect(tie).toBeDefined();
    expect(tie!.monthly).toMatchObject({ planId: "p-t-m", amountMinor: 7900 });
  });

  it("tool without plans cannot be purchased (excluded, not fake CTA)", () => {
    const { availableToAdd } = buildBillingToolSections({
      entitlements: [],
      plans: PLANS.filter((p) => p.tool_id !== "tool-draft"),
      tools: TOOLS_ROWS,
    });
    expect(availableToAdd.some((t) => t.toolSlug === "draft-ban")).toBe(false);
  });
});
