import { describe, expect, it } from "vitest";
import {
  BGMI_FINISH_POINT_VALUE_2026,
  BGMI_POINTS_TABLE_2026,
  isCanonicalTable2026,
  matchTotal,
  placementPointsFor,
  stageTotal,
} from "./points";

describe("BGMI points — KRAFTON 2026 table", () => {
  it("maps placements to the canonical table", () => {
    expect(BGMI_POINTS_TABLE_2026).toEqual([10, 6, 5, 4, 3, 2, 1, 1]);
    expect(BGMI_FINISH_POINT_VALUE_2026).toBe(1);
    expect(placementPointsFor(1)).toBe(10);
    expect(placementPointsFor(2)).toBe(6);
    expect(placementPointsFor(7)).toBe(1);
    expect(placementPointsFor(8)).toBe(1);
    expect(placementPointsFor(9)).toBe(0);
    expect(placementPointsFor(16)).toBe(0);
    expect(placementPointsFor(0)).toBe(0);
  });

  it("computes match totals as placement + finishes", () => {
    expect(matchTotal({ placement: 1, finishes: 20 })).toEqual({
      placementPoints: 10,
      finishPoints: 20,
      total: 30,
    });
    expect(matchTotal({ placement: 16, finishes: 0 })).toEqual({
      placementPoints: 0,
      finishPoints: 0,
      total: 0,
    });
  });

  it("adds starting points to stage totals", () => {
    expect(stageTotal(28, [30, 8, 13])).toBe(79);
    expect(stageTotal(0, [])).toBe(0);
  });

  it("detects a changed source scoring table", () => {
    expect(isCanonicalTable2026([10, 6, 5, 4, 3, 2, 1, 1], 1)).toBe(true);
    expect(isCanonicalTable2026([10, 6, 5, 4, 3, 2, 1, 1], 2)).toBe(false);
    expect(isCanonicalTable2026([12, 9, 8, 6, 5, 4, 2, 2], 1)).toBe(false);
    expect(isCanonicalTable2026([10, 6, 5, 4, 3, 2, 1], 1)).toBe(false);
  });
});
