import { describe, it, expect } from "vitest";
import { calculateRenewedExpiry } from "./expiry";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("billing expiry — calculateRenewedExpiry", () => {
  it("no existing expiry -> now + monthly", () => {
    const now = utc(2026, 10, 5);
    expect(calculateRenewedExpiry(null, now, "monthly")).toEqual(utc(2026, 11, 5));
  });

  it("no existing expiry -> now + yearly", () => {
    const now = utc(2026, 10, 5);
    expect(calculateRenewedExpiry(undefined, now, "yearly")).toEqual(utc(2027, 10, 5));
  });

  it("existing in future -> existing + monthly", () => {
    const now = utc(2026, 10, 5);
    const existing = utc(2026, 11, 5); // Nov 5 future
    expect(calculateRenewedExpiry(existing, now, "monthly")).toEqual(utc(2026, 12, 5));
  });

  it("existing in future -> existing + yearly", () => {
    const now = utc(2026, 10, 5);
    const existing = utc(2026, 11, 5);
    expect(calculateRenewedExpiry(existing, now, "yearly")).toEqual(utc(2027, 11, 5));
  });

  it("existing in past -> now + monthly", () => {
    const now = utc(2026, 10, 5);
    const existing = utc(2026, 9, 5); // Sep 5 past
    expect(calculateRenewedExpiry(existing, now, "monthly")).toEqual(utc(2026, 11, 5));
  });

  it("existing in past -> now + yearly", () => {
    const now = utc(2026, 10, 5);
    const existing = utc(2025, 10, 5);
    expect(calculateRenewedExpiry(existing, now, "yearly")).toEqual(utc(2027, 10, 5));
  });

  it("existing exactly now -> now + period", () => {
    const now = utc(2026, 10, 5);
    expect(calculateRenewedExpiry(now, now, "monthly")).toEqual(utc(2026, 11, 5));
  });

  it("all-access same behavior — monthly", () => {
    const now = utc(2026, 10, 5);
    const existing = utc(2026, 11, 5);
    // all-access uses same function — verify
    expect(calculateRenewedExpiry(existing, now, "monthly")).toEqual(utc(2026, 12, 5));
  });

  it("end-of-month existing future clamped", () => {
    const now = utc(2026, 1, 10);
    const existing = utc(2026, 1, 31);
    // existing Jan 31 + monthly -> Feb 28 (via addBillingPeriod)
    expect(calculateRenewedExpiry(existing, now, "monthly")).toEqual(utc(2026, 2, 28));
  });
});
