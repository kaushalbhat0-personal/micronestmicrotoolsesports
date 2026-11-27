import { describe, expect, it } from "vitest";
import {
  COMPETITIVE_LEVELS,
  isCompetitiveLevel,
  levelIndex,
  meetsLevelMinimum,
  SELF_REPORTED_LEVEL_NOTE,
} from "./levels";

describe("finder levels", () => {
  it("defines the six-step casual-to-professional progression", () => {
    expect(COMPETITIVE_LEVELS).toEqual([
      "casual",
      "community",
      "competitive",
      "higher-tier",
      "semi-pro",
      "professional",
    ]);
  });

  it("validates level values without accepting ratings or free text", () => {
    expect(isCompetitiveLevel("competitive")).toBe(true);
    expect(isCompetitiveLevel("semi-pro")).toBe(true);
    expect(isCompetitiveLevel("diamond")).toBe(false);
    expect(isCompetitiveLevel("2400 elo")).toBe(false);
    expect(isCompetitiveLevel(undefined)).toBe(false);
    expect(isCompetitiveLevel(null)).toBe(false);
  });

  it("orders levels monotonically", () => {
    const indices = COMPETITIVE_LEVELS.map(levelIndex);
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    expect(levelIndex("casual")).toBeLessThan(levelIndex("professional"));
  });

  it("allows at most one step below the minimum, never caps above", () => {
    // One step below passes.
    expect(meetsLevelMinimum("community", "competitive")).toBe(true);
    // Two steps below fails.
    expect(meetsLevelMinimum("casual", "competitive")).toBe(false);
    // Exact match passes.
    expect(meetsLevelMinimum("competitive", "competitive")).toBe(true);
    // Stronger players may always play down.
    expect(meetsLevelMinimum("professional", "casual")).toBe(true);
  });

  it("frames levels as self-reported context, never ratings", () => {
    expect(SELF_REPORTED_LEVEL_NOTE).toMatch(/self-reported/i);
    expect(SELF_REPORTED_LEVEL_NOTE).toMatch(/not a .* rating/i);
    expect(SELF_REPORTED_LEVEL_NOTE).not.toMatch(/mmr|elo|skill score/i);
  });
});
