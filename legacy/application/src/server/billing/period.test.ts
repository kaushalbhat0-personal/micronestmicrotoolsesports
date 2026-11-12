import { describe, it, expect } from "vitest";
import { addBillingPeriod } from "./period";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("billing period — addBillingPeriod", () => {
  it("monthly: Oct 5 -> Nov 5", () => {
    expect(addBillingPeriod(utc(2026, 10, 5), "monthly")).toEqual(utc(2026, 11, 5));
  });

  it("yearly: Oct 5 -> next year Oct 5", () => {
    expect(addBillingPeriod(utc(2026, 10, 5), "yearly")).toEqual(utc(2027, 10, 5));
  });

  it("monthly end-of-month Jan 31 -> Feb 28 (non-leap 2026)", () => {
    expect(addBillingPeriod(utc(2026, 1, 31), "monthly")).toEqual(utc(2026, 2, 28));
  });

  it("monthly end-of-month Jan 31 -> Feb 29 (leap 2024)", () => {
    expect(addBillingPeriod(utc(2024, 1, 31), "monthly")).toEqual(utc(2024, 2, 29));
  });

  it("yearly Feb 29 2024 -> Feb 28 2025 (non-leap clamp)", () => {
    expect(addBillingPeriod(utc(2024, 2, 29), "yearly")).toEqual(utc(2025, 2, 28));
  });

  it("monthly Dec 15 -> Jan 15 next year", () => {
    expect(addBillingPeriod(utc(2026, 12, 15), "monthly")).toEqual(utc(2027, 1, 15));
  });

  it("yearly Dec 31 -> next Dec 31", () => {
    expect(addBillingPeriod(utc(2026, 12, 31), "yearly")).toEqual(utc(2027, 12, 31));
  });

  it("preserves time component", () => {
    const d = new Date(Date.UTC(2026, 9, 5, 12, 34, 56, 789));
    const out = addBillingPeriod(d, "monthly");
    expect(out.getUTCHours()).toBe(12);
    expect(out.getUTCMinutes()).toBe(34);
    expect(out.getUTCSeconds()).toBe(56);
    expect(out.getUTCMilliseconds()).toBe(789);
  });

  it("throws on unknown period", () => {
    expect(() => addBillingPeriod(utc(2026, 10, 5), "weekly" as never)).toThrow();
  });
});
