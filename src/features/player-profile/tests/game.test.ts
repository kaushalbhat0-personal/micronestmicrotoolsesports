import { describe, expect, it } from "vitest";
import {
  availabilitySchema,
  bgmiPlayModesSchema,
  bgmiPrimaryRoleSchema,
  bgmiRegionSchema,
  gameKeySchema,
  gameUserIdSchema,
  ignSchema,
  validateGameRegion,
} from "../schemas/game";

describe("gameKeySchema (03 §2, 05 §1)", () => {
  it("accepts catalogue keys", () => {
    expect(gameKeySchema.parse("bgmi")).toBe("bgmi");
    expect(gameKeySchema.parse(" BGMI ")).toBe("bgmi");
  });

  it("rejects invalid keys", () => {
    for (const bad of ["", "x", "a".repeat(25), "has space", "UPPER!", "bgmi!"]) {
      expect(gameKeySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("bgmiRegionSchema is BGMI-only (D-G1-09)", () => {
  it("accepts the BGMI vocabulary including online", () => {
    expect(bgmiRegionSchema.parse("india")).toBe("india");
    expect(bgmiRegionSchema.parse("ONLINE")).toBe("online");
  });

  it("rejects values outside the BGMI vocabulary", () => {
    expect(bgmiRegionSchema.safeParse("atlantis").success).toBe(false);
    expect(bgmiRegionSchema.safeParse("").success).toBe(false);
  });

  it("never applies the BGMI vocabulary to unknown games", () => {
    expect(validateGameRegion("bgmi", "india")).toBe(true);
    expect(validateGameRegion("bgmi", "atlantis")).toBe(false);
    expect(validateGameRegion("some-future-title", "india")).toBe(false);
    expect(validateGameRegion("some-future-title", "online")).toBe(false);
  });
});

describe("bgmi role / modes / availability (03 §3, 05 §1)", () => {
  it("accepts the frozen BGMI roles", () => {
    for (const role of ["IGL", "Assaulter", "Support", "Scout"]) {
      expect(bgmiPrimaryRoleSchema.parse(role)).toBe(role);
    }
    expect(bgmiPrimaryRoleSchema.safeParse("Sniper").success).toBe(false);
  });

  it("accepts mode subsets up to 5", () => {
    expect(bgmiPlayModesSchema.parse(["squad", "tpp"])).toEqual(["squad", "tpp"]);
    expect(bgmiPlayModesSchema.parse([])).toEqual([]);
    expect(
      bgmiPlayModesSchema.safeParse(["squad", "duo", "solo", "tpp", "fpp", "extra"]).success,
    ).toBe(false);
    expect(bgmiPlayModesSchema.safeParse(["ranked"]).success).toBe(false);
  });

  it("caps availability windows at 7 without inventing the enum", () => {
    expect(availabilitySchema.parse(["weekend"])).toEqual(["weekend"]);
    expect(availabilitySchema.parse([])).toEqual([]);
    expect(availabilitySchema.safeParse(new Array(8).fill("weekend")).success).toBe(false);
  });
});

describe("ign / game_user_id (03 §3, 05 §1)", () => {
  it("enforces IGN 2-30 trimmed", () => {
    expect(ignSchema.parse("  Nova  ")).toBe("Nova");
    expect(ignSchema.safeParse("x").success).toBe(false);
    expect(ignSchema.safeParse("x".repeat(31)).success).toBe(false);
  });

  it("keeps game_user_id as optional text, 4-32", () => {
    expect(gameUserIdSchema.parse(undefined)).toBeUndefined();
    expect(gameUserIdSchema.parse("001234")).toBe("001234");
    expect(gameUserIdSchema.safeParse("123").success).toBe(false);
    expect(gameUserIdSchema.safeParse("x".repeat(33)).success).toBe(false);
  });
});
