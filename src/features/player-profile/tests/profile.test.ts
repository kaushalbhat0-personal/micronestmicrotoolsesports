import { describe, expect, it } from "vitest";
import { bioSchema, displayNameSchema } from "../schemas/profile";

describe("displayNameSchema (03 §1, 05 §1)", () => {
  it("accepts 1-40 chars, trimmed", () => {
    expect(displayNameSchema.parse("  Kai  ")).toBe("Kai");
    expect(displayNameSchema.parse("x".repeat(40))).toBe("x".repeat(40));
  });

  it("rejects empty, overlong, and markup", () => {
    expect(displayNameSchema.safeParse("").success).toBe(false);
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(displayNameSchema.safeParse("<b>Kai</b>").success).toBe(false);
  });
});

describe("bioSchema (03 §1)", () => {
  it("is optional and accepts up to 280 chars", () => {
    expect(bioSchema.parse(undefined)).toBeUndefined();
    expect(bioSchema.parse("BGMI scout.")).toBe("BGMI scout.");
    expect(bioSchema.parse("x".repeat(280))).toBe("x".repeat(280));
  });

  it("rejects overlong and markup payloads", () => {
    expect(bioSchema.safeParse("x".repeat(281)).success).toBe(false);
    expect(bioSchema.safeParse("<script>alert(1)</script>").success).toBe(false);
  });
});
