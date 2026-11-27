// P5 prize-pool schema tests (pure, no database).
// Covers major/percent parsing boundaries, row and form coherence,
// and the malformed-input matrix.

import { describe, expect, it } from "vitest";
import {
  MAX_POSITION,
  MAX_PAYOUT_ROWS,
  MAX_PRIZE_MINOR,
  parseMajorToMinor,
  parsePercentToBps,
  prizePoolFormSchema,
} from "@/features/tools/prize-pool/schema";

describe("parseMajorToMinor", () => {
  it("parses whole and decimal majors without floating point", () => {
    expect(parseMajorToMinor("100000")).toBe(10_000_000);
    expect(parseMajorToMinor("2500.50")).toBe(250_050);
    expect(parseMajorToMinor("0.01")).toBe(1);
    expect(parseMajorToMinor("0")).toBe(0);
  });

  it("tolerates whitespace and grouping commas", () => {
    expect(parseMajorToMinor("  1,00,000  ")).toBe(10_000_000);
  });

  it("rejects negatives, letters, extra decimals, empties and overflow", () => {
    for (const bad of ["-5", "-0.01", "abc", "", "12.345", "1.2.3", ".5", "1e6", "₹100"]) {
      expect(parseMajorToMinor(bad), bad).toBeNull();
    }
    expect(parseMajorToMinor(String(MAX_PRIZE_MINOR / 100 + 1))).toBeNull();
  });
});

describe("parsePercentToBps", () => {
  it("parses percentages to basis points", () => {
    expect(parsePercentToBps("50")).toBe(5_000);
    expect(parsePercentToBps("12.5")).toBe(1_250);
    expect(parsePercentToBps("0.01")).toBe(1);
    expect(parsePercentToBps("100")).toBe(10_000);
    expect(parsePercentToBps("0")).toBe(0);
  });

  it("rejects negatives, >100%, malformed and empty input", () => {
    for (const bad of ["-1", "100.01", "150", "abc", "", "12.345", "50%"]) {
      expect(parsePercentToBps(bad), bad).toBeNull();
    }
  });
});

describe("prizePoolFormSchema", () => {
  const validForm = {
    total: "100000",
    currency: "INR",
    rows: [
      { position: 1, mode: "fixed", amount: "50000", percent: "" },
      { position: 2, mode: "percent", amount: "", percent: "30" },
      { position: 3, mode: "percent", amount: "", percent: "20" },
    ],
  };

  it("accepts a coherent mixed fixed/percent form", () => {
    expect(prizePoolFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("normalizes lowercase currency codes", () => {
    const parsed = prizePoolFormSchema.safeParse({ ...validForm, currency: "inr" });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported currencies, zero rows, and oversized fields", () => {
    expect(
      prizePoolFormSchema.safeParse({ ...validForm, currency: "EUR" }).success,
    ).toBe(false);
    expect(prizePoolFormSchema.safeParse({ ...validForm, rows: [] }).success).toBe(false);
    expect(
      prizePoolFormSchema.safeParse({
        ...validForm,
        rows: Array.from({ length: MAX_PAYOUT_ROWS + 1 }, (_, index) => ({
          position: index + 1,
          mode: "percent" as const,
          amount: "",
          percent: "1",
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate positions and out-of-range positions", () => {
    const dup = {
      ...validForm,
      rows: [
        { position: 1, mode: "fixed", amount: "10", percent: "" },
        { position: 1, mode: "percent", amount: "", percent: "10" },
      ],
    };
    expect(prizePoolFormSchema.safeParse(dup).success).toBe(false);
    const far = {
      ...validForm,
      rows: [{ position: MAX_POSITION + 1, mode: "fixed", amount: "10", percent: "" }],
    };
    expect(prizePoolFormSchema.safeParse(far).success).toBe(false);
  });

  it("rejects percentages summing above 100% and fixed sums above the total", () => {
    const overPercent = {
      ...validForm,
      rows: [
        { position: 1, mode: "percent", amount: "", percent: "60" },
        { position: 2, mode: "percent", amount: "", percent: "50" },
      ],
    };
    expect(prizePoolFormSchema.safeParse(overPercent).success).toBe(false);
    const overFixed = {
      total: "100",
      currency: "INR",
      rows: [{ position: 1, mode: "fixed", amount: "101", percent: "" }],
    };
    expect(prizePoolFormSchema.safeParse(overFixed).success).toBe(false);
  });

  it("rejects malformed row values and protected keys (strict)", () => {
    const badRow = {
      ...validForm,
      rows: [{ position: 1, mode: "fixed", amount: "abc", percent: "" }],
    };
    expect(prizePoolFormSchema.safeParse(badRow).success).toBe(false);
    expect(
      prizePoolFormSchema.safeParse({ ...validForm, owner_user_id: "someone" }).success,
    ).toBe(false);
  });
});
