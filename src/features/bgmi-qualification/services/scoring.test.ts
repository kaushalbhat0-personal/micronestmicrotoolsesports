import { describe, expect, it } from "vitest";
import {
  averageProjection,
  compareToTarget,
  isOutOfReachUnderAssumptions,
  isValidFinishes,
  isValidMatches,
  isValidPlacement,
  isValidPoints,
  placementPoints,
  planningBand,
  pointsGap,
  projectedTotal,
  requiredRate,
  scenarioPoints,
} from "./scoring";
import { KRAFTON_2026_PRESET } from "./presets";

const P = KRAFTON_2026_PRESET;

describe("placement points — KRAFTON 2026 canonical table", () => {
  it.each([
    [1, 10],
    [2, 6],
    [3, 5],
    [4, 4],
    [5, 3],
    [6, 2],
    [7, 1],
    [8, 1],
    [9, 0],
    [16, 0],
  ])("%i → %i", (placement, expected) => {
    expect(placementPoints(P, placement)).toBe(expected);
  });

  it("rejects out-of-range placements", () => {
    expect(placementPoints(P, 0)).toBeNull();
    expect(placementPoints(P, 17)).toBeNull();
    expect(placementPoints(P, 1.5)).toBeNull();
  });
});

describe("finishes", () => {
  it.each([[0], [1], [8], [31]])("%i finishes valid", (f) => {
    expect(isValidFinishes(P, f)).toBe(true);
  });

  it("rejects negative, fractional, over-cap finishes", () => {
    expect(isValidFinishes(P, -1)).toBe(false);
    expect(isValidFinishes(P, 2.5)).toBe(false);
    expect(isValidFinishes(P, 32)).toBe(false);
  });
});

describe("scenario — approved worked example", () => {
  it("42 + (1st + 8 finishes) = 60", () => {
    const sc = scenarioPoints(P, 1, 8);
    expect(sc).toEqual({ placementPoints: 10, finishPoints: 8, total: 18 });
    expect(projectedTotal(42, sc?.total ?? 0)).toBe(60);
  });

  it("5th + 5 finishes = +8", () => {
    expect(scenarioPoints(P, 5, 5)).toEqual({ placementPoints: 3, finishPoints: 5, total: 8 });
  });

  it("returns null for invalid scenario input", () => {
    expect(scenarioPoints(P, 0, 5)).toBeNull();
    expect(scenarioPoints(P, 3, -2)).toBeNull();
  });
});

describe("gap and required rate", () => {
  it("58 − 42 = 16", () => {
    expect(pointsGap(42, 58)).toBe(16);
  });

  it("16 / 4 = 4", () => {
    expect(requiredRate(16, 4)).toBe(4);
  });

  it("zero matches → null rate (no division by zero)", () => {
    expect(requiredRate(16, 0)).toBeNull();
  });
});

describe("verdict comparison", () => {
  it("projected = target → exact (needs tiebreak)", () => {
    expect(compareToTarget(58, 58)).toBe("exact");
  });

  it("projected > target → above", () => {
    expect(compareToTarget(60, 58)).toBe("above");
  });

  it("projected < target → below", () => {
    expect(compareToTarget(50, 58)).toBe("below");
  });
});

describe("average-rate mode", () => {
  it("42 + 4 × 4 = 58", () => {
    expect(averageProjection(42, 4, 4)).toBe(58);
  });

  it("rejects negative averages and bad matches", () => {
    expect(averageProjection(42, -1, 4)).toBeNull();
    expect(averageProjection(42, Number.NaN, 4)).toBeNull();
    expect(averageProjection(42, 4, -1)).toBeNull();
  });
});

describe("planning band", () => {
  it("is assumption-based and flags out-of-reach only under assumptions", () => {
    const band = planningBand(20, 4);
    expect(band.best).toBe(20 + 4 * 20);
    expect(band.worst).toBe(20 + 4 * 2);
    expect(isOutOfReachUnderAssumptions(band, 200)).toBe(true);
    expect(isOutOfReachUnderAssumptions(band, 100)).toBe(false);
  });
});

describe("input validation", () => {
  it("rejects negative points and oversized values", () => {
    expect(isValidPoints(-1)).toBe(false);
    expect(isValidPoints(10000)).toBe(false);
    expect(isValidPoints(42)).toBe(true);
  });

  it("rejects negative matches", () => {
    expect(isValidMatches(-1)).toBe(false);
    expect(isValidMatches(4)).toBe(true);
  });

  it("validates placements against the preset", () => {
    expect(isValidPlacement(P, 16)).toBe(true);
    expect(isValidPlacement(P, 17)).toBe(false);
  });
});
