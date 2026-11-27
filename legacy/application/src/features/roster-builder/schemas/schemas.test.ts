import { describe, expect, it } from "vitest";
import {
  delimiterSchema,
  parseOptionsSchema,
  pastedInputSchema,
  playerNameSchema,
  teamCapacitySchema,
  teamNameSchema,
} from "./index";
import { MAX_INPUT_CHARS } from "../types";

describe("boundary schemas", () => {
  it("accepts pasted text within the character cap and rejects beyond it", () => {
    expect(pastedInputSchema.safeParse("Alpha\tRahul").success).toBe(true);
    expect(pastedInputSchema.safeParse("").success).toBe(false);
    expect(pastedInputSchema.safeParse("x".repeat(MAX_INPUT_CHARS + 1)).success).toBe(false);
    expect(pastedInputSchema.safeParse(42).success).toBe(false);
  });

  it("accepts the four supported delimiters and nothing else", () => {
    for (const delimiter of ["\t", ",", ";", "|"]) {
      expect(delimiterSchema.safeParse(delimiter).success).toBe(true);
    }
    expect(delimiterSchema.safeParse(":").success).toBe(false);
    expect(delimiterSchema.safeParse("tab").success).toBe(false);
  });

  it("bounds team capacity to whole configurable sizes", () => {
    expect(teamCapacitySchema.safeParse(5).success).toBe(true);
    expect(teamCapacitySchema.safeParse(1).success).toBe(true);
    expect(teamCapacitySchema.safeParse(30).success).toBe(true);
    expect(teamCapacitySchema.safeParse(0).success).toBe(false);
    expect(teamCapacitySchema.safeParse(31).success).toBe(false);
    expect(teamCapacitySchema.safeParse(2.5).success).toBe(false);
    expect(teamCapacitySchema.safeParse("5").success).toBe(false);
  });

  it("keeps parse options fully optional", () => {
    expect(parseOptionsSchema.safeParse({}).success).toBe(true);
    expect(parseOptionsSchema.safeParse({ delimiter: ",", teamCapacity: 6 }).success).toBe(true);
    expect(parseOptionsSchema.safeParse({ delimiter: ":" }).success).toBe(false);
  });

  it("trims names and enforces display caps", () => {
    expect(teamNameSchema.safeParse("  Alpha  ").success).toBe(true);
    expect(teamNameSchema.safeParse("").success).toBe(false);
    expect(teamNameSchema.safeParse("T".repeat(61)).success).toBe(false);
    expect(playerNameSchema.safeParse("P".repeat(41)).success).toBe(false);
    expect(playerNameSchema.safeParse("Rahul").success).toBe(true);
  });
});
