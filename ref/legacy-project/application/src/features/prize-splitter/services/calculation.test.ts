import { describe, it, expect } from "vitest";
import { calculateSplit, validateInput, toMinor, fromMinor, buildCopyText } from "./calculation";
import type { SplitInput } from "../types";

describe("prize-splitter calculation", () => {
  describe("validateInput", () => {
    it("validates prizePool required", () => {
      const r = validateInput({ prizePool: NaN, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.field === "prizePool")).toBe(true);
    });
    it("rejects Infinity", () => {
      const r = validateInput({ prizePool: Infinity, currency: "USD", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
      expect(r.valid).toBe(false);
    });
    it("rejects non-positive", () => {
      expect(validateInput({ prizePool: 0, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] }).valid).toBe(false);
      expect(validateInput({ prizePool: -10, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] }).valid).toBe(false);
    });
    it("requires 100% total", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }] });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.message.includes("100%"))).toBe(true);
    });
    it("rejects 99.99", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 49.99 }] });
      expect(r.valid).toBe(false);
    });
    it("rejects >100", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 60 }, { label: "2nd", percentage: 50 }] });
      expect(r.valid).toBe(false);
    });
    it("rejects negative percentage", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: -10 }, { label: "2nd", percentage: 110 }] });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.message.includes("negative"))).toBe(true);
    });
    it("rejects duplicate labels", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "1st", percentage: 50 }] });
      expect(r.valid).toBe(false);
    });
    it("allows zero percentage entry if total 100", () => {
      const r = validateInput({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }, { label: "2nd", percentage: 0 }] });
      expect(r.valid).toBe(true);
    });
    it("validates equalCount positive integer", () => {
      expect(validateInput({ prizePool: 1000, currency: "INR", method: "equal", placements: [], equalCount: 0 }).valid).toBe(false);
      expect(validateInput({ prizePool: 1000, currency: "INR", method: "equal", placements: [], equalCount: 1.5 }).valid).toBe(false);
      expect(validateInput({ prizePool: 1000, currency: "INR", method: "equal", placements: [], equalCount: 5 }).valid).toBe(true);
    });
  });

  describe("percentage method", () => {
    it("calculates 50/30/20 on 100000", () => {
      const input: SplitInput = { prizePool: 100000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] };
      const r = calculateSplit(input);
      expect(r.placements[0]?.payout).toBe(50000);
      expect(r.placements[1]?.payout).toBe(30000);
      expect(r.placements[2]?.payout).toBe(20000);
      expect(r.totalDistributed).toBe(100000);
      expect(r.isBalanced).toBe(true);
      expect(r.remaining).toBe(0);
    });
    it("handles many placements", () => {
      const placements = Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}th`, percentage: 10 }));
      const r = calculateSplit({ prizePool: 1000, currency: "USD", method: "percentage", placements });
      expect(r.placements).toHaveLength(10);
      expect(r.totalDistributed).toBe(1000);
      r.placements.forEach((p) => expect(p.payout).toBe(100));
    });
  });

  describe("equal split", () => {
    it("1 recipient gets all", () => {
      const r = calculateSplit({ prizePool: 1000, currency: "USD", method: "equal", placements: [], equalCount: 1 });
      expect(r.placements).toHaveLength(1);
      expect(r.placements[0]?.payout).toBe(1000);
    });
    it("2 recipients", () => {
      const r = calculateSplit({ prizePool: 100, currency: "INR", method: "equal", placements: [], equalCount: 2 });
      expect(r.placements.map((p) => p.payout)).toEqual([50, 50]);
    });
    it("5 recipients even", () => {
      const r = calculateSplit({ prizePool: 100000, currency: "INR", method: "equal", placements: [], equalCount: 5 });
      expect(r.placements.every((p) => p.payout === 20000)).toBe(true);
      expect(r.totalDistributed).toBe(100000);
    });
    it("odd amount 100 split 3 ways reconciles", () => {
      const r = calculateSplit({ prizePool: 100, currency: "INR", method: "equal", placements: [], equalCount: 3 });
      expect(r.totalDistributed).toBe(100);
      expect(r.remaining).toBe(0);
      // 33.34,33.33,33.33 pattern via largest remainder
      const sorted = [...r.placements].map((p) => p.payout).sort((a, b) => b - a);
      expect(sorted[0]).toBe(33.34);
      expect(sorted[1]).toBe(33.33);
      expect(sorted[2]).toBe(33.33);
    });
    it("rounding remainder deterministic — 10 split 3 ways", () => {
      const r = calculateSplit({ prizePool: 10, currency: "USD", method: "equal", placements: [], equalCount: 3 });
      expect(r.totalDistributed).toBe(10);
      // 3.34, 3.33, 3.33
      expect(r.placements[0]?.payout).toBe(3.34);
    });
  });

  describe("ranked/custom", () => {
    it("custom add placements", () => {
      const r = calculateSplit({ prizePool: 1000, currency: "EUR", method: "custom", placements: [{ label: "1st", percentage: 40 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }, { label: "4th", percentage: 10 }] });
      expect(r.placements).toHaveLength(4);
      expect(r.totalDistributed).toBe(1000);
    });
    it("ranked preset top5", () => {
      const percentages = [35, 25, 20, 12, 8];
      const placements = percentages.map((pct, i) => ({ label: `${i + 1}th`, percentage: pct }));
      const r = calculateSplit({ prizePool: 10000, currency: "GBP", method: "ranked", placements });
      expect(r.placements[0]?.payout).toBe(3500);
      expect(r.totalDistributed).toBe(10000);
    });
  });

  describe("money precision", () => {
    it("fractional prize pool ₹100 with 33.33% splits reconciles", () => {
      const r = calculateSplit({ prizePool: 100, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33 }, { label: "2nd", percentage: 33.33 }, { label: "3rd", percentage: 33.34 }] });
      expect(r.totalDistributed).toBe(100);
      expect(r.remaining).toBe(0);
      expect(r.isBalanced).toBe(true);
    });
    it("decimal prize pool 100.50 split", () => {
      const r = calculateSplit({ prizePool: 100.5, currency: "USD", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 50 }] });
      expect(r.totalDistributed).toBe(100.5);
      // 50.25 each
      expect(r.placements[0]?.payout).toBe(50.25);
      expect(r.placements[1]?.payout).toBe(50.25);
    });
    it("small amount 1 INR 50/50", () => {
      const r = calculateSplit({ prizePool: 1, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 50 }] });
      expect(r.totalDistributed).toBe(1);
      expect(r.placements[0]?.payout).toBe(0.5);
      expect(r.placements[1]?.payout).toBe(0.5);
    });
    it("large amount 1M", () => {
      const r = calculateSplit({ prizePool: 1000000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] });
      expect(r.totalDistributed).toBe(1000000);
    });
    it("fractional payouts sum exactly", () => {
      // 10 * 33.33/33.33/33.34 on 10
      const r = calculateSplit({ prizePool: 10, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33 }, { label: "2nd", percentage: 33.33 }, { label: "3rd", percentage: 33.34 }] });
      expect(r.totalDistributedMinor).toBe(toMinor(10));
    });
    it("toMinor / fromMinor roundtrip", () => {
      expect(fromMinor(toMinor(100.5))).toBe(100.5);
      expect(fromMinor(toMinor(0.01))).toBe(0.01);
    });
  });

  describe("buildCopyText", () => {
    it("contains prize pool and placements", () => {
      const r = calculateSplit({ prizePool: 100000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] });
      const t = buildCopyText(r);
      expect(t).toContain("Prize Pool");
      expect(t).toContain("1st — 50%");
      expect(t).toContain("Total Distributed");
    });
  });

  describe("intentional default (RCCF-TOOL-02A)", () => {
    it("default method is Percentage with 50/30/20 on ₹100,000 INR", async () => {
      const { DEFAULT_METHOD, DEFAULT_PRIZE_POOL, DEFAULT_CURRENCY, DEFAULT_PLACEMENTS } = await import("../types");
      expect(DEFAULT_METHOD).toBe("percentage");
      expect(DEFAULT_PRIZE_POOL).toBe(100000);
      expect(DEFAULT_CURRENCY).toBe("INR");
      expect(DEFAULT_PLACEMENTS).toEqual([
        { label: "1st", percentage: 50 },
        { label: "2nd", percentage: 30 },
        { label: "3rd", percentage: 20 },
      ]);
      // Verify default calculates to balanced 50k/30k/20k
      const r = calculateSplit({ prizePool: 100000, currency: "INR", method: "percentage", placements: DEFAULT_PLACEMENTS });
      expect(r.isBalanced).toBe(true);
      expect(r.totalDistributed).toBe(100000);
      expect(r.placements.map((p) => p.payout)).toEqual([50000, 30000, 20000]);
    });
  });
});
