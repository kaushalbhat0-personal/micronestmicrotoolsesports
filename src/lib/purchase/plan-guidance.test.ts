import { describe, expect, it } from "vitest";
import { coveredToolSlugs, formatPlanPrice, getPurchaseGuide, periodLabel } from "./plan-guidance";

describe("purchase guidance — customer-safe plan context", () => {
  it("maps each paid plan slug to a human tool name (never a slug)", () => {
    expect(getPurchaseGuide("draft-ban-monthly")?.toolName).toBe("Draft & Ban");
    expect(getPurchaseGuide("draft-ban-yearly")?.toolName).toBe("Draft & Ban");
    expect(getPurchaseGuide("sponsorship-tracking-monthly")?.toolName).toBe("Sponsorship Tracking");
    expect(getPurchaseGuide("prize-pool-splitter-yearly")?.toolName).toBe("Prize Pool Splitter");
    expect(getPurchaseGuide("all-access-monthly")?.toolName).toBe("All Access");
  });

  it("returns null for unknown, empty, or missing slugs", () => {
    expect(getPurchaseGuide("scrim-matchmaker-monthly")).toBeNull();
    expect(getPurchaseGuide("not-a-plan")).toBeNull();
    expect(getPurchaseGuide("")).toBeNull();
    expect(getPurchaseGuide(null)).toBeNull();
    expect(getPurchaseGuide(undefined)).toBeNull();
  });

  it("never exposes internal tool slugs in customer-facing names", () => {
    for (const slug of ["draft-ban-monthly", "sponsorship-tracking-monthly", "prize-pool-splitter-monthly", "all-access-yearly"]) {
      const name = getPurchaseGuide(slug)?.toolName ?? "";
      expect(name).not.toContain("-");
      expect(name.toLowerCase()).not.toContain("sentinel");
    }
  });

  it("builds workspace tool routes without leaking slugs", () => {
    expect(getPurchaseGuide("draft-ban-monthly")?.toolRoute("acme")).toBe("/dashboard/acme/draft-ban");
    expect(getPurchaseGuide("sponsorship-tracking-monthly")?.toolRoute("acme")).toBe("/dashboard/acme/sponsor-sentinel/campaigns");
    expect(getPurchaseGuide("prize-pool-splitter-monthly")?.toolRoute("acme")).toBe("/dashboard/acme/prize-splitter");
    expect(getPurchaseGuide("all-access-monthly")?.toolRoute("acme")).toBe("/dashboard/acme");
  });

  it("provides a first step for every guide", () => {
    for (const slug of ["draft-ban-monthly", "sponsorship-tracking-monthly", "prize-pool-splitter-monthly", "all-access-monthly"]) {
      expect(getPurchaseGuide(slug)?.firstStep.length).toBeGreaterThan(0);
    }
  });

  it("covers internal tool slugs for access checks (code-only, never rendered)", () => {
    expect(coveredToolSlugs("draft-ban-monthly")).toEqual(["draft-ban"]);
    expect(coveredToolSlugs("sponsorship-tracking-yearly")).toEqual(["sponsor-sentinel"]);
    expect(coveredToolSlugs("prize-pool-splitter-monthly")).toEqual(["prize-splitter"]);
    expect(coveredToolSlugs("all-access-monthly")).toEqual(["sponsor-sentinel", "prize-splitter", "draft-ban"]);
    expect(coveredToolSlugs("nope")).toEqual([]);
    expect(coveredToolSlugs(null)).toEqual([]);
  });

  it("formats plan prices for customers", () => {
    expect(formatPlanPrice(79900, "INR")).toBe("₹799");
    expect(formatPlanPrice(249900, "INR")).toBe("₹2,499");
    expect(periodLabel("monthly")).toBe("month");
    expect(periodLabel("yearly")).toBe("year");
  });
});
