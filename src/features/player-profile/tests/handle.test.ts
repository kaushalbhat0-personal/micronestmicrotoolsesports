import { describe, expect, it } from "vitest";
import { handleInputSchema, handleSchema } from "../schemas/handle";

describe("handleSchema (03 §1, 05 §1)", () => {
  it("accepts valid handles and normalizes case/whitespace", () => {
    expect(handleSchema.parse("Player_01")).toBe("player_01");
    expect(handleSchema.parse("  abc  ")).toBe("abc");
    expect(handleSchema.parse("a".repeat(20))).toBe("a".repeat(20));
  });

  it("rejects invalid formats", () => {
    for (const bad of ["ab", "a".repeat(21), "has space", "UPPER-DASH", "dots.ok", "slash/x", "", "éclair"]) {
      expect(handleSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects non-string input", () => {
    expect(handleSchema.safeParse(123).success).toBe(false);
    expect(handleSchema.safeParse(null).success).toBe(false);
  });
});

describe("handleInputSchema mass-assignment resistance (08 T4)", () => {
  it("rejects unknown keys", () => {
    expect(
      handleInputSchema.safeParse({ handle: "abc", user_id: "x" }).success,
    ).toBe(false);
    expect(
      handleInputSchema.safeParse({ handle: "abc", status: "active" }).success,
    ).toBe(false);
  });
});
