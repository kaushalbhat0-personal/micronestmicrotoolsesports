import { describe, expect, it } from "vitest";
import { calculateTotals, formatMinor, fromMinor, toMinor } from "./totals";
import { deadlineState, formatDeadlineDate, formatMaskedReference, formatPaidDate } from "./deadline";
import { assertTransition, canTransition } from "./transitions";

describe("payout-tracker totals", () => {
  it("sums promised, paid, and remaining in minor units", () => {
    const totals = calculateTotals([
      { amount_minor: 5000000, status: "paid" },
      { amount_minor: 3000000, status: "pending" },
    ]);
    expect(totals.totalMinor).toBe(8000000);
    expect(totals.paidMinor).toBe(5000000);
    expect(totals.remainingMinor).toBe(3000000);
    expect(totals.paidCount).toBe(1);
    expect(totals.totalCount).toBe(2);
    expect(totals.percentPaid).toBe(62); // floored
  });

  it("handles empty recipient lists without NaN", () => {
    const totals = calculateTotals([]);
    expect(totals.totalMinor).toBe(0);
    expect(totals.percentPaid).toBe(0);
  });

  it("converts major/minor without float drift", () => {
    expect(toMinor(100.5)).toBe(10050);
    expect(fromMinor(10050)).toBe(100.5);
  });

  it("formats per-currency with locale grouping", () => {
    expect(formatMinor(10000000, "INR")).toContain("₹");
    expect(formatMinor(10000000, "INR")).toContain("1,00,000");
    expect(formatMinor(50000, "USD")).toContain("$");
  });
});

describe("payout-tracker deadline", () => {
  const noon = new Date("2026-12-20T12:00:00Z");

  it("classifies upcoming, due-today, overdue, and none", () => {
    expect(deadlineState(null, noon)).toBe("none");
    expect(deadlineState("2026-12-25T00:00:00.000Z", noon)).toBe("upcoming");
    expect(deadlineState("2026-12-20T00:00:00.000Z", noon)).toBe("due-today");
    expect(deadlineState("2026-12-19T00:00:00.000Z", noon)).toBe("overdue");
  });

  it("formats dates at day granularity", () => {
    expect(formatDeadlineDate("2026-12-20T00:00:00.000Z")).toBe("20 Dec 2026");
    expect(formatDeadlineDate(null)).toBeNull();
    expect(formatPaidDate("2026-12-21T15:30:00.000Z")).toBe("21 Dec 2026");
    expect(formatPaidDate(null)).toBeNull();
  });

  it("masks references to last-4 only", () => {
    expect(formatMaskedReference("a1B2")).toBe("····a1B2");
    expect(formatMaskedReference(null)).toBeNull();
  });
});

describe("payout-tracker transitions", () => {
  it("allows draft→published, published→completed, completed→published", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("published", "completed")).toBe(true);
    expect(canTransition("completed", "published")).toBe(true);
  });

  it("rejects unpublish, draft→completed, and published→draft", () => {
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("completed", "draft")).toBe(false);
    expect(() => assertTransition("published", "draft")).toThrow();
  });
});
