import { describe, expect, it } from "vitest";
import { averageProjection } from "./scoring";
import { formatPoints } from "./format";

describe("formatPoints — floating-point presentation guard", () => {
  it("collapses the canonical 0.1 × 3 artifact to a human-readable value", () => {
    // Illustrative literal from the audit (0.1 × 3 = 0.30000000000000004).
    expect(formatPoints(42.300000000000004)).toBe("42.3");
    // Genuine engine-produced artifact: 1 + 1.1 × 3 = 4.300000000000001.
    const raw = averageProjection(1, 1.1, 3);
    expect(raw).toBe(4.300000000000001);
    expect(raw !== null ? formatPoints(raw) : null).toBe("4.3");
  });

  it("renders integers without decimals", () => {
    expect(formatPoints(42)).toBe("42");
    expect(formatPoints(60)).toBe("60");
    expect(formatPoints(averageProjection(42, 4, 4) ?? Number.NaN)).toBe("58");
  });

  it("renders one-decimal and ordinary decimal projections as-is", () => {
    expect(formatPoints(42.5)).toBe("42.5");
    expect(formatPoints(66)).toBe("66");
    expect(formatPoints(42.125)).toBe("42.125");
  });

  it("formats computed shortfalls without artifacts", () => {
    const projected = averageProjection(1, 1.1, 3) ?? 0;
    expect(formatPoints(58 - projected)).toBe("53.7");
  });

  it("never exposes scientific notation or non-finite values", () => {
    expect(formatPoints(100000)).toBe("100000");
    expect(formatPoints(Number.NaN)).toBe("—");
    expect(formatPoints(Number.POSITIVE_INFINITY)).toBe("—");
    const text = formatPoints(42.300000000000004);
    expect(text).not.toContain("e");
    expect(text).not.toContain("E");
    expect(text).not.toContain("00000004");
  });
});
