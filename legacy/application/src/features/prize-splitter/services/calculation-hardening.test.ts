import { describe, it, expect } from "vitest";
import { calculateSplit, validateInput, formatMoney, canonicalPct, toMinor } from "./calculation";
import { MAX_PRIZE_POOL } from "../types";

describe("calculation hardening", () => {
  it("locale INR grouping", () => {
    expect(formatMoney(100000, "INR")).toBe("₹1,00,000.00");
  });
  it("locale USD grouping", () => {
    // en-US grouping
    const v = formatMoney(100000, "USD");
    expect(v).toContain("$");
    expect(v).toContain("100,000.00");
    expect(v).not.toContain("1,00,000");
  });
  it("locale EUR grouping (de-DE)", () => {
    const v = formatMoney(1000.5, "EUR");
    expect(v).toContain("€");
    // de-DE uses . for thousands, , for decimal
    expect(v).toContain("1.000,50");
  });
  it("locale GBP grouping (en-GB)", () => {
    const v = formatMoney(100000, "GBP");
    expect(v).toContain("£");
    expect(v).toContain("100,000.00");
  });

  it("max prize pool valid", () => {
    const r = calculateSplit({ prizePool: MAX_PRIZE_POOL, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    expect(r.prizePool).toBe(MAX_PRIZE_POOL);
    expect(r.isBalanced).toBe(true);
  });

  it("max + 1 rejected", () => {
    const v = validateInput({ prizePool: MAX_PRIZE_POOL + 1, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "prizePool")).toBe(true);
  });

  it("very large but under max passes safe integer", () => {
    // 500M *100 = 50B fits safe
    expect(toMinor(500_000_000)).toBe(50_000_000_000);
    expect(Number.isSafeInteger(toMinor(500_000_000))).toBe(true);
  });

  it("decimal percentage canonical 2 decimals", () => {
    expect(canonicalPct(33.33333)).toBe(33.33);
    expect(canonicalPct(33.335)).toBe(33.34);
    expect(canonicalPct(50.005)).toBe(50.01);
  });

  it("33.33333 trio canonical sums 99.99 -> invalid (must use 33.33/33.33/33.34)", () => {
    const v = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33333 }, { label: "2nd", percentage: 33.33333 }, { label: "3rd", percentage: 33.33333 }] });
    // after canonical 33.33*3 =99.99 -> invalid
    expect(v.valid).toBe(false);
  });

  it("canonical 33.33/33.33/33.34 is valid", () => {
    const v = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33 }, { label: "2nd", percentage: 33.33 }, { label: "3rd", percentage: 33.34 }] });
    expect(v.valid).toBe(true);
    const r = calculateSplit({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33 }, { label: "2nd", percentage: 33.33 }, { label: "3rd", percentage: 33.34 }] });
    expect(r.totalDistributed).toBe(1000);
  });

  it("calculate with excess decimal rounds deterministically", () => {
    const r = calculateSplit({ prizePool: 100, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.3339 }, { label: "2nd", percentage: 33.3339 }, { label: "3rd", percentage: 33.34 }] });
    // 33.3339 ->33.33, third 33.34 -> total 100.00 valid
    expect(r.totalDistributed).toBe(100);
  });
});
