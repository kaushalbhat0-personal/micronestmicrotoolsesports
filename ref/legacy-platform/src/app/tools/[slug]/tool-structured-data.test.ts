import { describe, it, expect } from "vitest";
import { buildOffers } from "@/lib/marketing/tool-offers";

describe("tool structured data — pricing correctness", () => {
  it("available tool emits INR offers with price > 0", () => {
    const plans = [
      { slug: "sponsorship-tracking-monthly", name: "Sponsorship Tracking — Monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR" },
      { slug: "sponsorship-tracking-yearly", name: "Sponsorship Tracking — Yearly", billing_period: "yearly", amount_minor: 1499000, currency: "INR" },
    ];
    const { offers } = buildOffers(plans, "available");
    expect(Array.isArray(offers)).toBe(true);
    const arr = offers as Array<Record<string, unknown>>;
    expect(arr.length).toBe(2);
    for (const o of arr) {
      expect(o.priceCurrency).toBe("INR");
      expect(Number(o.price)).toBeGreaterThan(0);
      expect(o.price).not.toBe("0");
      expect(o.availability).toBe("https://schema.org/InStock");
    }
    const prices = arr.map((o) => o.price as string);
    expect(prices).not.toContain("0");
    // Ensure no USD
    for (const o of arr) expect(o.priceCurrency).not.toBe("USD");
  });

  it("prize-pool-splitter emits INR offers", () => {
    const plans = [
      { slug: "prize-pool-splitter-monthly", name: "Prize Pool Splitter — Monthly", billing_period: "monthly", amount_minor: 69900, currency: "INR" },
      { slug: "prize-pool-splitter-yearly", name: "Prize Pool Splitter — Yearly", billing_period: "yearly", amount_minor: 699000, currency: "INR" },
    ];
    const { offers } = buildOffers(plans, "available");
    const arr = offers as Array<Record<string, unknown>>;
    expect(arr.some((o) => o.price === "699")).toBe(true);
    expect(arr.some((o) => o.price === "6990")).toBe(true);
    for (const o of arr) expect(o.priceCurrency).toBe("INR");
  });

  it("coming-soon emits PreOrder without price", () => {
    const { offers } = buildOffers(null, "coming-soon");
    const o = offers as Record<string, unknown>;
    expect(o["@type"]).toBe("Offer");
    expect(o.availability).toBe("https://schema.org/PreOrder");
    expect(o.price).toBeUndefined();
    expect(o.priceCurrency).toBeUndefined();
  });

  it("coming-soon with empty plans also PreOrder no price", () => {
    const { offers } = buildOffers([], "available");
    const o = offers as Record<string, unknown>;
    expect(o.availability).toBe("https://schema.org/PreOrder");
    expect(o.price).toBeUndefined();
  });

  it("never emits $0 USD", () => {
    const plans = [
      { slug: "sponsorship-tracking-monthly", name: "Sponsorship Tracking — Monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR" },
    ];
    const { offers } = buildOffers(plans, "available");
    const arr = offers as Array<Record<string, unknown>>;
    for (const o of arr) {
      expect(o.price).not.toBe("0");
      expect(o.priceCurrency).not.toBe("USD");
    }
    const coming = buildOffers(null, "coming-soon").offers as Record<string, unknown>;
    expect(coming.price).not.toBe("0");
  });
});
