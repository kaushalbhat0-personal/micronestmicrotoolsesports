import { describe, expect, it } from "vitest";
import {
  PLANLESS_FREE_TOOLS,
  TOOL_PLAN_PREFIX,
  buildFreeToolOffers,
  buildOffers,
} from "./tool-offers";

/**
 * Tool-offer presentation semantics (RCCF-TOOLBOX-IA-02).
 *
 * Roster Builder is released and free with no paid plan: it must never
 * render PreOrder / coming-soon JSON-LD and never gain a fake plan.
 */
describe("tool offers", () => {
  it("treats Roster Builder as available and plan-less, never PreOrder", () => {
    expect(PLANLESS_FREE_TOOLS.has("tournament-roster-builder")).toBe(true);
    const result = buildFreeToolOffers();
    expect(result.offers).toBeNull();
    expect(result.availability).toBe("https://schema.org/InStock");
  });

  it("keeps TOOL_PLAN_PREFIX at the five paid tools only", () => {
    expect(Object.keys(TOOL_PLAN_PREFIX).sort()).toEqual(
      ["draft-ban", "prize-payout-tracker", "prize-pool-splitter", "sponsorship-tracking", "tie-breaker"].sort()
    );
    expect(TOOL_PLAN_PREFIX["tournament-roster-builder"]).toBeUndefined();
    expect(TOOL_PLAN_PREFIX["meta-parser"]).toBeUndefined();
  });

  it("emits InStock offers for available tools with INR plans", () => {
    const result = buildOffers(
      [{ slug: "draft-ban-monthly", name: "Draft & Ban — Monthly", billing_period: "monthly", amount_minor: 79900, currency: "INR" }],
      "available"
    );
    expect(result.availability).toBe("https://schema.org/InStock");
    expect(Array.isArray(result.offers)).toBe(true);
  });

  it("emits PreOrder only for genuinely unavailable tools", () => {
    const result = buildOffers(null, "coming-soon");
    expect(result.availability).toBe("https://schema.org/PreOrder");
  });
});
