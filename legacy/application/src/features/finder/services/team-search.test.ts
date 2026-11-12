import { describe, expect, it } from "vitest";
import { activeTeamFilterCount, parseTeamSearchParams } from "./team-search";

describe("team search params", () => {
  it("defaults to recruiting-only BGMI discovery", () => {
    expect(parseTeamSearchParams({})).toEqual({
      game: "bgmi",
      query: undefined,
      region: undefined,
      currentLevel: undefined,
      targetLevel: undefined,
      recruitingOnly: true,
      limit: 60,
    });
  });

  it("accepts valid level and text filters", () => {
    const parsed = parseTeamSearchParams({
      q: "  night-hawks ",
      current_level: "competitive",
      target_level: "higher-tier",
      region: "IN-South",
    });
    expect(parsed.query).toBe("night-hawks");
    expect(parsed.currentLevel).toBe("competitive");
    expect(parsed.targetLevel).toBe("higher-tier");
    expect(parsed.region).toBe("IN-South");
  });

  it("ignores unknown enum values instead of breaking discovery", () => {
    const parsed = parseTeamSearchParams({ current_level: "diamond" });
    expect(parsed.currentLevel).toBeUndefined();
  });

  it("lets users include non-recruiting teams explicitly", () => {
    expect(parseTeamSearchParams({ recruiting: "0" }).recruitingOnly).toBeUndefined();
  });

  it("counts only active user filters", () => {
    expect(activeTeamFilterCount(parseTeamSearchParams({}))).toBe(0);
    expect(
      activeTeamFilterCount(parseTeamSearchParams({ q: "a", region: "IN-North" })),
    ).toBe(2);
  });

  it("never fabricates counts or match scores", () => {
    const parsed = parseTeamSearchParams({ q: "hawks" });
    expect(parsed).not.toHaveProperty("matchScore");
    expect(parsed).not.toHaveProperty("totalCount");
  });
});
