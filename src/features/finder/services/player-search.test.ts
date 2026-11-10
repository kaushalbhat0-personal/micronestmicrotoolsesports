import { describe, expect, it } from "vitest";
import { activeFilterCount, parsePlayerSearchParams } from "./player-search";

describe("player search params", () => {
  it("returns BGMI defaults for empty input", () => {
    expect(parsePlayerSearchParams({})).toEqual({
      game: "bgmi",
      query: undefined,
      currentLevel: undefined,
      targetLevel: undefined,
      role: undefined,
      region: undefined,
      openToTryout: undefined,
      limit: 60,
    });
  });

  it("accepts valid level, role, and text filters", () => {
    const parsed = parsePlayerSearchParams({
      q: "  scout_07 ",
      current_level: "competitive",
      target_level: "higher-tier",
      role: "Scout",
      region: "IN-South",
      open_to_tryout: "1",
    });
    expect(parsed.query).toBe("scout_07");
    expect(parsed.currentLevel).toBe("competitive");
    expect(parsed.targetLevel).toBe("higher-tier");
    expect(parsed.role).toBe("Scout");
    expect(parsed.region).toBe("IN-South");
    expect(parsed.openToTryout).toBe(true);
  });

  it("ignores unknown enum values instead of breaking discovery", () => {
    const parsed = parsePlayerSearchParams({
      current_level: "diamond",
      role: "AWPer",
    });
    expect(parsed.currentLevel).toBeUndefined();
    expect(parsed.role).toBeUndefined();
  });

  it("trims and caps free text, treating blanks as absent", () => {
    expect(parsePlayerSearchParams({ q: "   " }).query).toBeUndefined();
    expect(parsePlayerSearchParams({ q: "x".repeat(100) }).query?.length).toBe(40);
  });

  it("counts only active filters", () => {
    expect(activeFilterCount(parsePlayerSearchParams({}))).toBe(0);
    expect(
      activeFilterCount(parsePlayerSearchParams({ q: "a", role: "IGL", open_to_tryout: "1" })),
    ).toBe(3);
  });

  it("never fabricates counts or match scores", () => {
    const parsed = parsePlayerSearchParams({ q: "pro" });
    expect(parsed).not.toHaveProperty("matchScore");
    expect(parsed).not.toHaveProperty("totalCount");
  });
});
