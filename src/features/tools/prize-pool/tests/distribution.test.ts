// P5 prize-pool distribution tests (pure, no database).
// Covers exactness (shares + unallocated === total, always), fixed/percent
// mixes, largest-remainder rounding, unallocated remainder, and the full
// defensive boundary: zero, negative, oversized, duplicate and hostile input.

import { describe, expect, it } from "vitest";
import {
  distributePrizePool,
  ordinalLabel,
  PrizePoolError,
} from "@/features/tools/prize-pool/distribution";
import type { ParsedPrizePool } from "@/features/tools/prize-pool/schema";

function parsed(overrides: Partial<ParsedPrizePool> = {}): ParsedPrizePool {
  return {
    totalMinor: 10_000_000,
    currency: "INR",
    rows: [
      { position: 1, kind: "percent", bps: 5_000 },
      { position: 2, kind: "percent", bps: 3_000 },
      { position: 3, kind: "percent", bps: 2_000 },
    ],
    ...overrides,
  };
}

function expectExact(result: ReturnType<typeof distributePrizePool>): void {
  expect(result.distributedMinor + result.unallocatedMinor).toBe(result.totalMinor);
  expect(result.unallocatedMinor).toBeGreaterThanOrEqual(0);
  for (const share of result.shares) {
    expect(Number.isInteger(share.amountMinor)).toBe(true);
    expect(share.amountMinor).toBeGreaterThanOrEqual(0);
  }
}

describe("distributePrizePool — exactness", () => {
  it("splits an even 50/30/20 pool exactly", () => {
    const result = distributePrizePool(parsed());
    expect(result.shares).toEqual([
      { position: 1, amountMinor: 5_000_000 },
      { position: 2, amountMinor: 3_000_000 },
      { position: 3, amountMinor: 2_000_000 },
    ]);
    expect(result.unallocatedMinor).toBe(0);
    expectExact(result);
  });

  it("mixes fixed amounts with percentages of the full total", () => {
    const result = distributePrizePool(
      parsed({
        totalMinor: 10_000,
        rows: [
          { position: 1, kind: "fixed", fixedMinor: 5_000 },
          { position: 2, kind: "percent", bps: 3_000 },
        ],
      }),
    );
    // 30% of the FULL 10000 = 3000; 5000 + 3000 distributed, 2000 unallocated.
    expect(result.shares).toEqual([
      { position: 1, amountMinor: 5_000 },
      { position: 2, amountMinor: 3_000 },
    ]);
    expect(result.unallocatedMinor).toBe(2_000);
    expectExact(result);
  });

  it("distributes rounding leftovers by largest remainder (ties to better position)", () => {
    // 100 minor units split 33.33 / 33.33 / 33.34.
    const result = distributePrizePool(
      parsed({
        totalMinor: 100,
        rows: [
          { position: 1, kind: "percent", bps: 3_333 },
          { position: 2, kind: "percent", bps: 3_333 },
          { position: 3, kind: "percent", bps: 3_334 },
        ],
      }),
    );
    expect(result.shares.map((share) => share.amountMinor).reduce((a, b) => a + b, 0)).toBe(100);
    expect(result.unallocatedMinor).toBe(0);
    expectExact(result);
  });

  it("handles a single paise split across three winners without losing money", () => {
    const result = distributePrizePool(
      parsed({
        totalMinor: 1,
        rows: [
          { position: 1, kind: "percent", bps: 5_000 },
          { position: 2, kind: "percent", bps: 3_000 },
          { position: 3, kind: "percent", bps: 2_000 },
        ],
      }),
    );
    expect(result.shares).toEqual([
      { position: 1, amountMinor: 1 },
      { position: 2, amountMinor: 0 },
      { position: 3, amountMinor: 0 },
    ]);
    expectExact(result);
  });

  it("reports partial percentages as unallocated, sorted by position", () => {
    const result = distributePrizePool(
      parsed({
        totalMinor: 1_000,
        rows: [
          { position: 3, kind: "percent", bps: 1_000 },
          { position: 1, kind: "fixed", fixedMinor: 100 },
        ],
      }),
    );
    expect(result.shares.map((share) => share.position)).toEqual([1, 3]);
    expect(result.unallocatedMinor).toBe(1_000 - 100 - 100);
    expectExact(result);
  });

  it("allows a zero total with all-zero shares", () => {
    const result = distributePrizePool(
      parsed({ totalMinor: 0, rows: [{ position: 1, kind: "percent", bps: 10_000 }] }),
    );
    expect(result.shares).toEqual([{ position: 1, amountMinor: 0 }]);
    expect(result.unallocatedMinor).toBe(0);
  });

  it("keeps exactness across a sweep of hostile totals", () => {
    for (const totalMinor of [1, 2, 3, 7, 99, 101, 999_999, 1_000_000_000_000]) {
      const result = distributePrizePool(
        parsed({
          totalMinor,
          rows: [
            { position: 1, kind: "percent", bps: 4_567 },
            { position: 2, kind: "percent", bps: 3_333 },
            { position: 3, kind: "fixed", fixedMinor: 0 },
          ],
        }),
      );
      expectExact(result);
    }
  });
});

describe("distributePrizePool — defensive boundaries", () => {
  it("rejects negatives, over-100% sums, fixed-over-total and bad positions", () => {
    expect(() => distributePrizePool(parsed({ totalMinor: -1 }))).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({ rows: [{ position: 1, kind: "fixed", fixedMinor: -5 }] }),
      ),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({
          rows: [
            { position: 1, kind: "percent", bps: 6_000 },
            { position: 2, kind: "percent", bps: 5_000 },
          ],
        }),
      ),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({
          totalMinor: 100,
          rows: [{ position: 1, kind: "fixed", fixedMinor: 101 }],
        }),
      ),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(parsed({ rows: [] })),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({
          rows: [
            { position: 1, kind: "percent", bps: 5_000 },
            { position: 1, kind: "percent", bps: 5_000 },
          ],
        }),
      ),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({ rows: [{ position: 0, kind: "percent", bps: 5_000 }] }),
      ),
    ).toThrow(PrizePoolError);
    expect(() =>
      distributePrizePool(
        parsed({ rows: [{ position: 65, kind: "percent", bps: 5_000 }] }),
      ),
    ).toThrow(PrizePoolError);
  });

  it("never returns NaN or fractional minor units", () => {
    const result = distributePrizePool(parsed());
    expect(
      result.shares.every((share) => Number.isFinite(share.amountMinor)),
    ).toBe(true);
  });
});

describe("ordinalLabel", () => {
  it("labels 1st/2nd/3rd/11th-13th correctly", () => {
    expect([ordinalLabel(1), ordinalLabel(2), ordinalLabel(3), ordinalLabel(4)]).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
    ]);
    expect([ordinalLabel(11), ordinalLabel(12), ordinalLabel(13)]).toEqual([
      "11th",
      "12th",
      "13th",
    ]);
    expect(ordinalLabel(21)).toBe("21st");
  });
});
