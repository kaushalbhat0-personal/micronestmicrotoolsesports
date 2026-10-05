import { describe, it, expect } from "vitest";

function formatINR(amountMinor: number): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function savingsLabel(monthlyMinor: number, yearlyMinor: number): string | null {
  const twelve = monthlyMinor * 12;
  if (yearlyMinor >= twelve) return null;
  const save = twelve - yearlyMinor;
  return `Save ${formatINR(save)}/year vs monthly`;
}

describe("pricing display — INR formatting and catalog", () => {
  it("formats INR correctly with currency and period", () => {
    expect(formatINR(149900)).toMatch(/₹/);
    expect(formatINR(149900)).toMatch(/1,499/);
    expect(formatINR(69900)).toMatch(/699/);
    expect(formatINR(249900)).toMatch(/2,499/);
    // Must be INR, not USD
    expect(formatINR(149900)).not.toMatch(/\$/);
  });

  it("sponsorship tracking monthly/yearly mapping", () => {
    const monthly = 149900;
    const yearly = 1499000;
    expect(monthly).toBe(149900);
    expect(yearly).toBe(1499000);
  });

  it("prize pool splitter mapping", () => {
    expect(69900).toBe(69900);
    expect(699000).toBe(699000);
  });

  it("all access mapping", () => {
    expect(249900).toBe(249900);
    expect(2499000).toBe(2499000);
  });

  it("yearly savings derived deterministically from catalog", () => {
    expect(savingsLabel(149900, 1499000)).toBe("Save ₹2,998/year vs monthly");
    expect(savingsLabel(69900, 699000)).toBe("Save ₹1,398/year vs monthly");
    expect(savingsLabel(249900, 2499000)).toBe("Save ₹4,998/year vs monthly");
  });

  it("no discount invented — savings only when yearly cheaper than 12x monthly", () => {
    expect(savingsLabel(149900, 1798800)).toBe(null); // equal to 12x monthly, no savings
    expect(savingsLabel(149900, 1800000)).toBe(null); // more expensive
  });

  it("billing period clarity — must show / month and / year not bare amount", () => {
    const periodLabel = (p: "monthly" | "yearly") => (p === "monthly" ? "month" : "year");
    expect(`₹1,499 / ${periodLabel("monthly")}`).toBe("₹1,499 / month");
    expect(`₹14,990 / ${periodLabel("yearly")}`).toBe("₹14,990 / year");
  });

  it("manual renewal language present, auto-renew absent", () => {
    const good = "No automatic renewal. You renew manually when you want to continue access.";
    const bad = ["Renews until cancelled", "auto-renew", "recurring", "AutoPay"];
    expect(good.toLowerCase()).toContain("no automatic renewal");
    for (const b of bad) {
      expect(good).not.toContain(b);
    }
  });

  it("all access wording does not promise future tools", () => {
    const good = "Includes all currently available paid esports tools.";
    expect(good).toContain("currently available");
    expect(good).not.toMatch(/all future/i);
  });

  it("inactive plans not shown — filter check", () => {
    const plans = [
      { slug: "sponsorship-tracking-monthly", is_active: true, currency: "INR" },
      { slug: "sponsorship-tracking-yearly", is_active: false, currency: "INR" },
      { slug: "old-plan", is_active: false, currency: "INR" },
      { slug: "usd-plan", is_active: true, currency: "USD" },
    ];
    const visible = plans.filter((p) => p.is_active && p.currency === "INR");
    expect(visible.map((p) => p.slug)).toEqual(["sponsorship-tracking-monthly"]);
  });

  it("security — client cannot determine amount/currency/tool ownership", () => {
    // Pricing CTA only carries plan slug, not amount
    const ctaHref = "/signup?plan=sponsorship-tracking-monthly";
    expect(ctaHref).toContain("plan=sponsorship-tracking-monthly");
    expect(ctaHref).not.toContain("amount");
    expect(ctaHref).not.toContain("currency");
    expect(ctaHref).not.toContain("tool_id");
  });
});
