// P7 tiebreak schema tests (pure, no database).
// Covers the Zod input boundary: score/weight bounds, name lengths,
// direction vocabulary, cutoff range, and the missing-vs-malformed split.

import { describe, expect, it } from "vitest";
import {
  criterionFormSchema,
  parseScoreField,
  scenarioFormSchema,
  scoreValueSchema,
  teamFormSchema,
} from "@/features/tools/tiebreak/schema";

describe("scenarioFormSchema", () => {
  it("accepts a named scenario with a cutoff", () => {
    expect(scenarioFormSchema.safeParse({ name: "Group A", cutoff: "4" }).success).toBe(true);
  });

  it("accepts an unnamed scenario with the cutoff off", () => {
    const parsed = scenarioFormSchema.safeParse({ name: "", cutoff: 0 });
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range cutoffs and oversized names", () => {
    expect(scenarioFormSchema.safeParse({ name: "", cutoff: -1 }).success).toBe(false);
    expect(scenarioFormSchema.safeParse({ name: "", cutoff: 25 }).success).toBe(false);
    expect(scenarioFormSchema.safeParse({ name: "x".repeat(49), cutoff: 0 }).success).toBe(false);
  });
});

describe("teamFormSchema", () => {
  it("accepts a well-formed team name", () => {
    expect(teamFormSchema.safeParse({ displayName: "Team Soul" }).success).toBe(true);
  });

  it("rejects blank, short, and oversized names", () => {
    for (const displayName of ["", " ", "A", "x".repeat(41)]) {
      expect(teamFormSchema.safeParse({ displayName }).success).toBe(false);
    }
  });
});

describe("criterionFormSchema", () => {
  it("accepts weighted criteria in either direction, including zero weight", () => {
    expect(
      criterionFormSchema.safeParse({ name: "Placement", weight: 10, direction: "high" }).success,
    ).toBe(true);
    expect(
      criterionFormSchema.safeParse({ name: "Deaths", weight: -2, direction: "low" }).success,
    ).toBe(true);
    expect(
      criterionFormSchema.safeParse({ name: "Tracked", weight: 0, direction: "high" }).success,
    ).toBe(true);
  });

  it("rejects bad names, non-integer weights, and unknown directions", () => {
    expect(
      criterionFormSchema.safeParse({ name: "X", weight: 1, direction: "high" }).success,
    ).toBe(false);
    expect(
      criterionFormSchema.safeParse({ name: "Valid", weight: 1001, direction: "high" }).success,
    ).toBe(false);
    expect(
      criterionFormSchema.safeParse({ name: "Valid", weight: 1.5, direction: "high" }).success,
    ).toBe(false);
    expect(
      criterionFormSchema.safeParse({ name: "Valid", weight: 1, direction: "up" }).success,
    ).toBe(false);
  });
});

describe("score values and fields", () => {
  it("accepts bounded integers including negatives", () => {
    expect(scoreValueSchema.safeParse("0").success).toBe(true);
    expect(scoreValueSchema.safeParse("-150").success).toBe(true);
    expect(scoreValueSchema.safeParse("1000000").success).toBe(true);
  });

  it("rejects decimals, text, and out-of-range input", () => {
    for (const raw of ["1.5", "abc", "1000001", "--5", "1,000"]) {
      expect(scoreValueSchema.safeParse(raw).success, raw).toBe(false);
    }
  });

  it("treats blank as missing, not as an error", () => {
    expect(parseScoreField("")).toEqual({ ok: true, value: null });
    expect(parseScoreField("   ")).toEqual({ ok: true, value: null });
    expect(parseScoreField("42")).toEqual({ ok: true, value: 42 });
    expect(parseScoreField("nope")).toEqual({ ok: false });
  });
});
